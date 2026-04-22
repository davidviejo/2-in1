# apps/project_manager.py
from flask import (
    Blueprint, render_template, request, redirect,
    url_for, session, send_file
)
import json
import io
import pandas as pd
from datetime import datetime
from werkzeug.utils import secure_filename
import logging
from urllib.parse import unquote, urlparse
import re
from apps.core.database import (
    get_all_projects,
    get_project,
    upsert_project,
    replace_clusters,
    delete_project,
    reset_all_projects,
    bulk_insert_projects
)
from apps.web.portal_bp import require_role_web

project_bp = Blueprint('project_bp', __name__)


# --- RUTAS PRINCIPALES ---

_MISSING_IMPORT_MARKERS = {"", "-"}


def _clean_cluster_attr(raw_value):
    """
    Normaliza atributos de importación de clústeres.
    Devuelve None cuando el valor debe considerarse "sin cambio"
    (vacío, NaN o marcador '-').
    """
    if raw_value is None or pd.isna(raw_value):
        return None
    value = str(raw_value).strip()
    if value.lower() == "nan":
        return None
    if value in _MISSING_IMPORT_MARKERS:
        return None
    return value




def _derive_keyword_from_url(raw_url):
    """
    Genera una keyword objetivo rápida a partir de la URL.
    Ejemplo: /servicios/seo-local/ -> "seo local"
    """
    if not raw_url:
        return ""

    source = str(raw_url).strip()
    if not source:
        return ""

    parsed = urlparse(source if '://' in source else f"https://dummy.local{source if source.startswith('/') else '/' + source}")

    path_parts = [part for part in parsed.path.split('/') if part.strip()]
    slug = path_parts[-1] if path_parts else ''

    if slug:
        slug = slug.rsplit('.', 1)[0]
        slug = unquote(slug)
        slug = re.sub(r'[-_]+', ' ', slug)
        slug = re.sub(r'\s+', ' ', slug).strip()
        return slug.lower()

    host = (parsed.netloc or '').replace('www.', '').strip()
    if host:
        domain_root = host.split(':', 1)[0].split('.')
        if domain_root:
            return domain_root[0].lower()

    return ""


def _find_best_column(columns, aliases):
    for col in columns:
        normalized = col.strip().lower()
        if any(alias in normalized for alias in aliases):
            return col
    return None

def merge_clusters_by_url(existing_clusters, imported_clusters):
    """
    Hace upsert de clusters por URL:
    - Si la URL importada existe, actualiza sus atributos con valores nuevos.
    - Si un atributo nuevo viene vacío o '-', mantiene el valor existente.
    - Si la URL no existe, crea un nuevo clúster.
    - Conserva clústeres existentes no incluidos en el archivo importado.
    """
    merged = [dict(cluster) for cluster in (existing_clusters or []) if isinstance(cluster, dict)]
    index_by_url = {}
    for idx, cluster in enumerate(merged):
        current_url = str(cluster.get("url", "")).strip()
        if current_url:
            index_by_url[current_url] = idx

    for imported in imported_clusters or []:
        if not isinstance(imported, dict):
            continue

        url = _clean_cluster_attr(imported.get("url"))
        if not url:
            continue

        name = _clean_cluster_attr(imported.get("name"))
        target_kw = _clean_cluster_attr(imported.get("target_kw"))

        if url in index_by_url:
            pos = index_by_url[url]
            current = merged[pos]
            if name is not None:
                current["name"] = name
            if target_kw is not None:
                current["target_kw"] = target_kw
            current["url"] = url
        else:
            merged.append({
                "name": name if name is not None else url,
                "url": url,
                "target_kw": target_kw if target_kw is not None else ""
            })
            index_by_url[url] = len(merged) - 1

    return merged

def get_active_project():
    """Retrieve the active project from DB."""
    p_id = session.get('active_project_id')
    if p_id:
        p = get_project(p_id)
        if p:
            return p
    # Return default empty structure
    return {
        "id": 0,
        "name": "Sin Asignar",
        "domain": "",
        "geo": "ES",
        "clusters": []
    }


@project_bp.route('/projects/manager')
@require_role_web(['operator'])
def manager():
    return render_template(
        'projects/manager.html',
        projects=get_all_projects(),
        active_id=str(session.get('active_project_id', 0))
    )


@project_bp.route('/projects/upload_clusters', methods=['POST'])
@require_role_web(['operator'])
def upload_clusters():
    """
    Ruta para procesar Excel/CSV y actualizar los clústeres del proyecto
    """
    p_id = request.form.get('id')
    file = request.files.get('file')

    if not p_id or not file:
        return "Faltan datos", 400

    try:
        filename = secure_filename(file.filename)
        # Detectar formato
        if filename.endswith('.csv'):
            df = pd.read_csv(file)
        elif filename.endswith(('.xls', '.xlsx')):
            df = pd.read_excel(file)
        else:
            return "Formato no soportado", 400

        # Normalizar columnas (mayúsculas/minúsculas)
        df.columns = [c.lower().strip() for c in df.columns]

        # Buscar columnas clave (soporta imports rápidos "URL | Kw objetivo")
        col_name = _find_best_column(df.columns, ('nombre', 'cluster', 'name'))
        col_url = _find_best_column(df.columns, ('url', 'link'))
        col_kw = _find_best_column(df.columns, ('keyword', 'clave', 'kw', 'target'))

        if not col_url:
            return "El archivo debe tener al menos una columna 'URL'", 400

        new_clusters = []
        for row in df.to_dict('records'):
            url = _clean_cluster_attr(row.get(col_url))
            if not url:
                continue

            new_clusters.append({
                "name": _clean_cluster_attr(row.get(col_name)) if col_name else None,
                "url": url,
                "target_kw": _clean_cluster_attr(row.get(col_kw)) if col_kw else None
            })

        # Upsert por URL conservando campos existentes cuando el import trae vacío o '-'
        project = get_project(p_id)
        existing_clusters = project.get("clusters", []) if project else []
        merged_clusters = merge_clusters_by_url(existing_clusters, new_clusters)
        replace_clusters(p_id, merged_clusters)

        return redirect(url_for('project_bp.manager'))

    except Exception:
        logging.error("Error processing cluster upload", exc_info=True)
        return "Error interno al procesar el archivo.", 500


@project_bp.route('/projects/auto_assign_keywords', methods=['POST'])
@require_role_web(['operator'])
def auto_assign_keywords():
    """
    Autocompleta KW objetivo para los clusters de un proyecto
    en base al slug de cada URL.
    """
    p_id = (request.form.get('id') or '').strip()
    apply_on = (request.form.get('apply_on') or 'missing').strip().lower()

    if not p_id:
        return "Falta el ID del proyecto", 400

    project = get_project(p_id)
    if not project:
        return "Proyecto no encontrado", 404

    clusters = [dict(cluster) for cluster in (project.get('clusters') or []) if isinstance(cluster, dict)]
    if not clusters:
        return redirect(url_for('project_bp.manager'))

    for cluster in clusters:
        current_kw = (cluster.get('target_kw') or '').strip()
        should_update = apply_on == 'all' or not current_kw
        if not should_update:
            continue

        inferred_kw = _derive_keyword_from_url(cluster.get('url', ''))
        if inferred_kw:
            cluster['target_kw'] = inferred_kw

    replace_clusters(p_id, clusters)
    return redirect(url_for('project_bp.manager'))


@project_bp.route('/projects/save', methods=['POST'])
@require_role_web(['operator'])
def save():
    """
    Crea o actualiza un proyecto (Upsert).
    Procesa datos básicos y clústeres asociados.
    """
    p_id = request.form.get('id')
    if p_id:
        p_id = p_id.strip()
        if len(p_id) > 50:
            return "ID demasiado largo (máx 50 caracteres)", 400

    name = request.form.get('name')
    if name and len(name) > 100:
        return "Nombre demasiado largo (máx 100 caracteres)", 400

    # Procesar Clústeres
    c_names = request.form.getlist('cluster_name[]')
    c_urls = request.form.getlist('cluster_url[]')
    c_kws = request.form.getlist('cluster_kw[]')

    clusters_list = []
    if c_urls:
        for i in range(min(len(c_names), len(c_urls))):
            if c_names[i].strip() and c_urls[i].strip():
                clusters_list.append({
                    "name": c_names[i].strip(),
                    "url": c_urls[i].strip(),
                    "target_kw": c_kws[i].strip() if i < len(c_kws) else ""
                })

    # Si no hay ID, generar uno nuevo
    if not p_id:
        p_id = str(int(datetime.now().timestamp()))
        is_new = True
    else:
        is_new = False

    new_data = {
        "id": p_id,
        "name": request.form.get('name'),
        "domain": request.form.get('domain'),
        "geo": request.form.get('geo'),
        "competitors": request.form.get('competitors'),
        "brand_name": request.form.get('brand_name', ''),
        "sitemap_url": request.form.get('sitemap_url', ''),
        "business_type": request.form.get('business_type', 'blog'),
    }

    # Guardar Proyecto
    upsert_project(new_data)

    # Lógica de preservación de clusters:
    # Si 'clusters_list' tiene datos, reemplazamos.
    # Si 'clusters_list' está vacío:
    #   - Si es nuevo proyecto, no hacemos nada (queda sin clusters).
    #   - Si es proyecto existente, NO llamamos a replace_clusters,
    #     así preservamos los que ya estaban en BD.
    if clusters_list:
        replace_clusters(p_id, clusters_list)
    elif is_new:
        # Opcional: Asegurarnos que no tenga basura si el ID se reusara
        replace_clusters(p_id, [])

    # Si es el primer proyecto, activarlo
    projects = get_all_projects()
    if len(projects) == 1:
        session['active_project_id'] = p_id

    return redirect(url_for('project_bp.manager'))


# Rutas estándar (export, import, delete, set_active...)
@project_bp.route('/projects/export')
@require_role_web(['operator'])
def export_db():
    """
    Exporta todos los proyectos y su configuración en un archivo JSON.
    Útil para backups o migración de datos.
    """
    mem = io.BytesIO()
    # Usamos get_all_projects que devuelve la estructura compatible con JSON
    mem.write(json.dumps(get_all_projects(), indent=4).encode('utf-8'))
    mem.seek(0)
    return send_file(
        mem,
        as_attachment=True,
        download_name='backup.json',
        mimetype='application/json'
    )


@project_bp.route('/projects/import', methods=['POST'])
@require_role_web(['operator'])
def import_db():
    """
    Importa proyectos desde un archivo JSON, reemplazando la base de datos
    actual.
    """
    f = request.files.get('file')
    if f:
        projects_data = json.load(f)
        if not isinstance(projects_data, list):
            return "Archivo inválido: se espera una lista de proyectos", 400

        reset_all_projects()

        # Use bulk insert for performance
        bulk_insert_projects(projects_data)

    return redirect(url_for('project_bp.manager'))


@project_bp.route('/projects/reset_all')
@require_role_web(['operator'])
def reset_all():
    reset_all_projects()
    session.clear()
    return redirect(url_for('project_bp.manager'))


@project_bp.route('/projects/set_active/<p_id>')
@require_role_web(['operator'])
def set_active(p_id):
    session['active_project_id'] = p_id
    return redirect(request.referrer or '/')


@project_bp.route('/projects/delete/<p_id>')
@require_role_web(['operator'])
def delete(p_id):
    delete_project(p_id)
    if str(session.get('active_project_id')) == str(p_id):
        session.pop('active_project_id', None)
    return redirect(url_for('project_bp.manager'))

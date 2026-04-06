# apps/autopilot.py - v10 INTELLIGENCE
from flask import Blueprint, render_template, jsonify, send_file, request
import threading
import logging
import requests
import time
import os
import json
import pandas as pd
import io
import glob
import statistics
from datetime import datetime
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from werkzeug.utils import secure_filename
from apps.web.blueprints.project_manager import get_active_project
from apps.tools.scraper_core import smart_serp_search
from apps.tools.credentials import (
    MISSING_DFS_CREDENTIALS_MESSAGE,
    resolve_dataforseo_credentials,
)
from apps.tools.utils import is_safe_url

autopilot_bp = Blueprint('autopilot_bp', __name__)

BASE_DIR = os.getcwd()
REPORTS_DIR = os.path.join(BASE_DIR, 'reports')
if not os.path.exists(REPORTS_DIR): os.makedirs(REPORTS_DIR)

auto_status = { "active": False, "phase": "Listo", "progress": 0, "current_action": "" }

def get_headers():
    return {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'}

# --- TU LÓGICA INTEGRADA ---

def classify_intent(kw: str) -> str:
    """
    Clasifica la intención de búsqueda de una palabra clave basándose en modificadores léxicos.

    Args:
        kw (str): La palabra clave a analizar.

    Returns:
        str: La categoría de intención (Transaccional, Informacional, Comercial, Navegacional o Mixta).
    """
    keyword_lower = (kw or '').lower()
    if any(x in keyword_lower for x in ['comprar', 'precio', 'oferta', 'tienda', 'reservar', 'barato', 'coste', 'presupuesto']):
        return 'Transaccional 💰'
    if any(x in keyword_lower for x in ['qué es', 'que es', 'cómo ', 'como ', 'guía', 'tutorial', 'definición', 'significado', 'pasos', 'ejemplos']):
        return 'Informacional 📚'
    if any(x in keyword_lower for x in ['mejor', 'mejores', 'top', 'opiniones', 'review', 'comparativa', 'vs', 'alternativas']):
        return 'Comercial ⚖️'
    if any(x in keyword_lower for x in ['login', 'inicio sesión', 'entrar', 'contacto']):
        return 'Navegacional 🧭'
    return 'Mixta / General'

# --- MOTORES DE ANÁLISIS ---

def analyze_headers_tree(soup):
    tree = []
    for tag in soup.find_all(['h1', 'h2', 'h3', 'h4']):
        tree.append({"type": tag.name.upper(), "text": tag.get_text(strip=True)[:100]})
    return tree

def analyze_performance_sim(start_time, html_size):
    ttfb = int((time.time() - start_time) * 1000)
    score = 100
    if ttfb > 400: score -= 5
    if ttfb > 1000: score -= 15
    if ttfb > 2000: score -= 30
    kb = html_size / 1024
    if kb > 200: score -= 10
    return max(0, score), ttfb

def audit_url_comprehensive(url, keyword=""):
    """
    Realiza una auditoría completa de una URL analizando métricas técnicas, de contenido y rendimiento.

    Args:
        url (str): La URL a auditar.
        keyword (str, optional): Palabra clave objetivo para análisis de relevancia.

    Returns:
        dict: Diccionario con métricas, puntuaciones (tech, content, perf, global) y lista de problemas detectados.
    """
    result = {
        "url": url, "metrics": {}, "issues": [],
        "score_tech": 100, "score_content": 100, "score_perf": 100, "score_global": 0,
        "intent_detected": "N/A"
    }

    try:
        if not is_safe_url(url):
            result['issues'].append("URL insegura (bloqueada)")
            return result

        # 1. Determinar Intención (Previo al escaneo)
        if keyword:
            result['intent_detected'] = classify_intent(keyword)

        start = time.time()
        response = requests.get(url, headers=get_headers(), timeout=20)
        result['metrics']['status'] = response.status_code

        perf_score, ttfb = analyze_performance_sim(start, len(response.content))
        result['score_perf'] = perf_score
        result['metrics']['ttfb'] = ttfb

        if response.status_code != 200:
            result['score_tech'] = 0
            result['issues'].append(f"Error HTTP {response.status_code}")
            return result

        soup = BeautifulSoup(response.text, 'html.parser')
        text = soup.get_text(" ", strip=True)

        # Datos PDF Style
        result['title'] = soup.title.string.strip() if soup.title else ""
        meta = soup.find('meta', attrs={'name': 'description'})
        result['meta_desc'] = meta['content'].strip() if meta else ""

        c_tag = soup.find('link', attrs={'rel': 'canonical'})
        result['canonical'] = c_tag['href'] if c_tag else "No definido"

        r_tag = soup.find('meta', attrs={'name': 'robots'})
        result['robots'] = r_tag['content'] if r_tag else "index, follow"

        # Enlaces
        links = soup.find_all('a', href=True)
        domain = urlparse(url).netloc
        internal = [l for l in links if domain in urlparse(l['href']).netloc]
        result['metrics']['internal_links'] = len(internal)

        # Estructura
        result['headers_tree'] = analyze_headers_tree(soup)
        h1_list = [x for x in result['headers_tree'] if x['type'] == 'H1']

        # Contenido
        result['metrics']['words'] = len(text.split())

        # Validación KW
        kw_density = 0
        if keyword:
            count = text.lower().count(keyword.lower())
            kw_density = round((count / max(1, result['metrics']['words'])) * 100, 2)

            if keyword.lower() not in result['title'].lower():
                result['issues'].append("KW no en Title")
                result['score_content'] -= 15
            if not h1_list or keyword.lower() not in h1_list[0]['text'].lower():
                result['issues'].append("KW no en H1")
                result['score_content'] -= 10

        result['metrics']['kw_density'] = kw_density

        # Validaciones Generales
        if not result['title']: result['score_content'] -= 20; result['issues'].append("Falta Title")
        if not result['meta_desc']: result['score_content'] -= 10; result['issues'].append("Falta Meta Desc")
        if len(h1_list) != 1: result['score_tech'] -= 10; result['issues'].append(f"Tiene {len(h1_list)} H1s")
        if result['metrics']['words'] < 300: result['score_content'] -= 20; result['issues'].append("Thin Content")

        result['score_global'] = int((result['score_tech'] + result['score_content'] + result['score_perf']) / 3)
        return result

    except Exception as e:
        logging.error(f"Audit error for {url}: {e}")
        result['issues'].append("Error de conexión o análisis")
        return result

def worker_elite_process(project, cfg=None):
    """
    Proceso en segundo plano que ejecuta la auditoría completa del proyecto.

    Itera sobre los clústeres definidos, realiza análisis de competidores (si aplica)
    y genera un reporte JSON con los resultados.

    Args:
        project (dict): Datos del proyecto activo.
        cfg (dict, optional): Configuración adicional para el análisis (modo, cookies, API keys).
    """
    try:
        auto_status['active'] = True
        auto_status['data'] = []

        domain = project.get('domain', '')
        if not domain.startswith('http'): domain = f"https://{domain}"

        clusters = project.get('clusters', [])
        # Soporte para estructura antigua/nueva
        if not clusters: clusters = [{"name": "Home", "url": "/", "target_kw": ""}]

        results = []
        total = len(clusters)

        for i, item in enumerate(clusters):
            # Normalización
            if isinstance(item, dict):
                name, path, kw = item.get('name', 'URL'), item.get('url', ''), item.get('target_kw', '')
            else:
                name, path, kw = 'URL', str(item), ''

            target_url = urljoin(domain, path)

            auto_status['current_action'] = f"Auditando ({i+1}/{total}): {name}"
            auto_status['progress'] = int(((i)/total)*100)

            # 1. CLIENTE
            client_data = audit_url_comprehensive(target_url, kw)
            client_data['name'] = name
            client_data['target_kw'] = kw

            # 2. COMPETENCIA (Con filtro inteligente)
            competitors_analysis = []
            if kw:
                auto_status['current_action'] = f"Analizando rivales para: {kw}..."

                # Selección de motor unificada (Soporta DataForSEO, Google, Scraping, DDG)
                cfg = cfg or {}

                # Preparamos config si faltan claves
                if 'cse_key' not in cfg and 'key' in cfg: cfg['cse_key'] = cfg['key']
                if 'cse_cx' not in cfg and 'cx' in cfg: cfg['cse_cx'] = cfg['cx']

                raw_rivals = smart_serp_search(
                    keyword=kw,
                    config=cfg,
                    num_results=5,
                    country=project.get('geo', 'es'),
                    lang='es' # Default lang
                )

                # Normalizar
                rivals = []
                if isinstance(raw_rivals, list):
                    for rival_item in raw_rivals:
                        if isinstance(rival_item, dict) and rival_item.get('url'):
                            rivals.append(rival_item)

                for rival in rivals:
                    rival_data = audit_url_comprehensive(rival['url'], kw)
                    if rival_data['score_global'] > 0:
                        competitors_analysis.append({
                            "domain": urlparse(rival['url']).netloc,
                            "url": rival['url'],
                            "words": rival_data['metrics']['words'],
                            "density": rival_data['metrics']['kw_density'],
                            "score": rival_data['score_global']
                        })
                    time.sleep(1) # Respetar scraping

            # 3. COMPARATIVA
            comparison = {}
            if competitors_analysis:
                avg_words = int(statistics.mean([c['words'] for c in competitors_analysis]))
                diff_words = client_data['metrics']['words'] - avg_words
                comparison = {
                    "avg_words": avg_words,
                    "diff_words": diff_words,
                    "rivals": competitors_analysis
                }
                if diff_words < -200:
                    client_data['issues'].append(f"⚠️ Faltan {abs(diff_words)} palabras vs Competencia")

            client_data['comparison'] = comparison
            results.append(client_data)
            time.sleep(0.5)

        # GUARDAR
        report_id = f"{project['id']}_{int(time.time())}"
        final_report = {
            "id": report_id,
            "project": project['name'],
            "date": datetime.now().strftime("%d/%m/%Y %H:%M"),
            "data": results
        }

        with open(os.path.join(REPORTS_DIR, f"report_{report_id}.json"), 'w', encoding='utf-8') as f:
            json.dump(final_report, f, indent=4)

        auto_status['progress'] = 100
        auto_status['current_action'] = "Finalizado"

    except Exception as e:
        auto_status['current_action'] = f"Error: {str(e)}"
        logging.error(f"Autopilot Worker Error: {e}")
    finally:
        auto_status['active'] = False

# --- RUTAS ---

@autopilot_bp.route('/autopilot/dashboard')
def dashboard(): return render_template('autopilot/dashboard.html')

@autopilot_bp.route('/autopilot/start', methods=['POST'])
def start():
    project = get_active_project()
    if project['id'] == 0: return jsonify({"status":"error", "message":"Sin Proyecto"})

    data = request.get_json() or {}
    config = {
        'mode': data.get('mode', 'ddg'),
        'cookie': data.get('cookie'),
        'google_cse_key': data.get('google_cse_key') or data.get('cse_key'),
        'google_cse_cx': data.get('google_cse_cx') or data.get('cse_cx'),
        'dataforseo_login': data.get('dataforseo_login') or data.get('dfs_login'),
        'dataforseo_password': data.get('dataforseo_password') or data.get('dfs_pass')
    }

    if config.get('mode') == 'dataforseo':
        dfs_credentials = resolve_dataforseo_credentials({
            'dataforseo_login': data.get('dataforseo_login') or data.get('dfs_login'),
            'dataforseo_password': data.get('dataforseo_password') or data.get('dfs_pass')
        })
        if not dfs_credentials.get('login') or not dfs_credentials.get('password'):
            return jsonify({"status": "error", "message": MISSING_DFS_CREDENTIALS_MESSAGE}), 400
        config['dataforseo_login'] = dfs_credentials['login']
        config['dataforseo_password'] = dfs_credentials['password']

    threading.Thread(target=worker_elite_process, args=(project, config)).start()
    return jsonify({"status":"started"})

@autopilot_bp.route('/autopilot/status')
def status(): return jsonify(auto_status)

@autopilot_bp.route('/autopilot/history')
def get_history():
    p = get_active_project()
    if p['id'] == 0: return jsonify([])
    files = glob.glob(os.path.join(REPORTS_DIR, f"report_{p['id']}_*.json"))
    files.sort(key=os.path.getmtime, reverse=True)
    hist = []
    for file_path in files:
        try:
            with open(file_path, 'r', encoding='utf-8') as file_obj: report_data = json.load(file_obj)
            hist.append({"id": report_data['id'], "date": report_data['date'], "count": len(report_data['data'])})
        except Exception as e:
            logging.error(f"Error reading report {file_path}: {e}")
    return jsonify(hist)

@autopilot_bp.route('/autopilot/load/<rid>')
def load_rep(rid):
    rid = secure_filename(rid)
    try:
        with open(os.path.join(REPORTS_DIR, f"report_{rid}.json"), 'r', encoding='utf-8') as file_obj:
            return jsonify(json.load(file_obj))
    except: return jsonify({"error": "No existe"}), 404

@autopilot_bp.route('/autopilot/delete/<rid>')
def delete_rep(rid):
    rid = secure_filename(rid)
    try:
        os.remove(os.path.join(REPORTS_DIR, f"report_{rid}.json"))
        return jsonify({"status": "ok"})
    except Exception as e:
        logging.error(f"Error deleting report {rid}: {e}")
        return jsonify({"status": "error"}), 500

@autopilot_bp.route('/autopilot/export/<rid>')
def export_rep(rid):
    rid = secure_filename(rid)
    try:
        with open(os.path.join(REPORTS_DIR, f"report_{rid}.json"), 'r', encoding='utf-8') as file_obj: data = json.load(file_obj)
        rows = []
        for row_data in data['data']:
            rows.append({
                "Nombre": row_data['name'], "URL": row_data['url'], "Score Global": row_data['score_global'],
                "Intención": row_data.get('intent_detected', '-'),
                "Title": row_data['title'], "Meta": row_data['meta_desc'], "Palabras": row_data['metrics']['words'],
                "Dif Competencia": row_data.get('comparison', {}).get('diff_words', 'N/A'),
                "Problemas": " | ".join(row_data['issues'])
            })
        df = pd.DataFrame(rows)
        output_stream = io.BytesIO()
        with pd.ExcelWriter(output_stream, engine='openpyxl') as writer: df.to_excel(writer, index=False)
        output_stream.seek(0)
        return send_file(output_stream, as_attachment=True, download_name=f'Audit_{rid}.xlsx', mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    except Exception as e:
        logging.error(f"Export error: {e}")
        return "Error generando reporte", 500

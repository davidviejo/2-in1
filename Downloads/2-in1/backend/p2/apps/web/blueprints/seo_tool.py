from flask import Blueprint, render_template, request, jsonify, send_file
import pandas as pd
import requests
from bs4 import BeautifulSoup
import time, io, threading, re, urllib.parse
from difflib import SequenceMatcher
from collections import Counter

from apps.core_monitor import update_global, reset_global
from apps.tools.scraper_core import smart_serp_search, GoogleSERPBlockedError
from apps.tools.credentials import (
    MISSING_DFS_CREDENTIALS_MESSAGE,
    resolve_dataforseo_credentials,
)

seo_bp = Blueprint('seo', __name__, url_prefix='/seo')

# Estado global del job
job_status = {
    'active': False,
    'progress': 0,
    'current_action': 'Esperando...',
    'results': [],
    'logs': [],
    'error': None,
    'diagnostics': {
        'keywords': {},
        'session': {
            'queries_total': 0,
            'queries_blocked': 0,
            'blocked_ratio': 0.0,
        }
    }
}
_status_lock = threading.Lock()


# --- UTILIDADES GENERALES ---

def update_status(**kwargs):
    """Actualizar job_status de manera thread-safe."""
    with _status_lock:
        job_status.update(kwargs)


def append_log(msg: str, keyword: str = None, technical_cause: str = None):
    """Añade una línea al log y, opcionalmente, una causa técnica resumida por keyword."""
    with _status_lock:
        job_status['logs'].append(msg)
        if keyword and technical_cause:
            job_status.setdefault('diagnostics', {}).setdefault('keywords', {})[keyword] = technical_cause
        # Nos quedamos con las últimas 300 líneas como máximo
        if len(job_status['logs']) > 300:
            job_status['logs'] = job_status['logs'][-300:]


def get_domain(url):
    try:
        return urllib.parse.urlparse(url).netloc.replace('www.', '')
    except Exception:
        return ''


def text_similarity(a, b):
    return SequenceMatcher(None, a or '', b or '').ratio()


def is_valid_url(url, title=None):
    if not url:
        return False
    blacklist = [
        'google.', 'duckduckgo.', 'bing.', 'yahoo.', 'facebook.', 'instagram.',
        'twitter.', 'youtube.', 'tiktok.', 'milanuncios.', 'fotocasa.',
        'idealista.', 'pinterest.'
    ]
    u = url.lower()
    for b in blacklist:
        if b in u:
            return False
    return True


def classify_intent(kw: str) -> str:
    """Clasificación muy sencilla de intención de búsqueda a partir de la keyword padre."""
    k = (kw or '').lower()
    if any(x in k for x in ['comprar', 'precio', 'oferta', 'tienda', 'reservar', 'barato']):
        return 'Transaccional'
    if any(x in k for x in ['qué es', 'que es', 'cómo ', 'como ', 'guía', 'tutorial', 'definición']):
        return 'Informacional'
    if any(x in k for x in ['mejor', 'mejores', 'top', 'opiniones', 'review', 'comparativa']):
        return 'Comercial'
    if any(x in k for x in ['facebook', 'instagram', 'twitter', 'login', 'inicio sesión']):
        return 'Navegacional'
    return 'Mixta / Desconocida'


# --- SCRAPER SIMPLE PARA PÁGINAS (ANÁLISIS ONPAGE) ---

def scrape_page_local(url: str):
    """
    Scraper sencillo local:
    - Cuenta palabras
    - Cuenta imágenes
    - Extrae estrutura básica (h1-h3)
    - Extrae entidades aproximadas (palabras más frecuentes)
    - Devuelve además title, h1 y todos los encabezados como lista
    """
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (compatible; SEO-Suite/1.0; +https://example.com)"
        }
        r = requests.get(url, headers=headers, timeout=15)
        r.raise_for_status()
        html = r.text
    except Exception:
        return None

    soup = BeautifulSoup(html, 'html.parser')

    # NUEVO: title y primer H1
    page_title = (soup.title.string.strip() if soup.title and soup.title.string else '') or ''
    h1_tag = soup.find('h1')
    h1_text = (h1_tag.get_text(strip=True) if h1_tag else '')

    # texto principal
    texts = soup.get_text(separator=' ')
    words = [w for w in re.split(r'\W+', texts) if w]
    word_count = len(words)

    # imágenes
    img_count = len(soup.find_all('img'))

    # estructura: encabezados
    structure_lines = []
    headings = []
    for tag in soup.find_all(['h1', 'h2', 'h3']):
        txt = (tag.get_text(strip=True) or '')[:120]
        if not txt:
            continue
        structure_lines.append(f"{tag.name.upper()}: {txt}")
        headings.append({'tag': tag.name.upper(), 'text': txt})

    # entidades "fake": palabras frecuentes (puedes mejorar esto si quieres)
    wc = Counter(w.lower() for w in words if len(w) > 3)
    entities = [w for w, c in wc.most_common(30)]

    return {
        'url': url,
        'title': page_title,
        'h1': h1_text,
        'words': word_count,
        'imgs': img_count,
        'structure': structure_lines,  # h1–h3 en forma de líneas de texto
        'headings': headings,          # h1–h3 como lista de dicts
        'entities': entities
    }


def scrape_page(url: str):
    """
    Wrapper que intenta usar el scraper del core si existe,
    y si falla usa el local sencillo.
    """
    try:
        # Import tardío para evitar dependencias circulares
        from apps.tools.scraper_core import scrape_page as core_scrape
        data = core_scrape(url)
        if data:
            return data
    except Exception:
        pass
    return scrape_page_local(url)


# --- DISPATCHER CENTRAL ---

def dispatcher(kw, cfg):
    """Router que elige qué motor usar según la configuración."""

    # 1. SerpApi (Legacy explicit support)
    if cfg.get('mode') == 'serpapi':
        try:
            params = {
                "engine": "google",
                "q": kw,
                "api_key": cfg.get('cse_key'),
                "num": cfg.get('top_n'),
                "google_domain": "google.es" if cfg.get('gl') == 'es' else "google.com",
                "gl": cfg.get('gl', 'es'),
                "hl": cfg.get('hl', 'es')
            }
            resp = requests.get("https://serpapi.com/search", params=params, timeout=cfg.get('tos', 15))
            data = resp.json()
            if "error" in data:
                raise Exception(f"SerpApi Error: {data['error']}")

            results = []
            for i, item in enumerate(data.get('organic_results', [])):
                results.append({
                    'url': item.get('link'),
                    'title': item.get('title'),
                    'rank': i + 1
                })
            return {'status': 'ok' if results else 'empty', 'results': results, 'error': None}
        except Exception as e:
            if "SerpApi Error" in str(e):
                return {'status': 'error', 'results': [], 'error': str(e)}
            return {'status': 'error', 'results': [], 'error': str(e)}

    # 2. Unified Smart Search (DataForSEO, Google, Scraping, DDG)
    # Mapeo de parámetros
    smart_cfg = dict(cfg)
    smart_cfg['return_diagnostics'] = True
    try:
        resp = smart_serp_search(
            keyword=kw,
            config=smart_cfg,
            num_results=cfg.get('top_n', 10),
            lang=cfg.get('hl', 'es'),
            country=cfg.get('gl', 'es')
        )
        if isinstance(resp, dict):
            return {
                'status': resp.get('status', 'ok'),
                'results': resp.get('results', []),
                'error': None,
                'provider': resp.get('provider'),
                'diagnostics': resp.get('diagnostics', {})
            }
        results = resp if isinstance(resp, list) else []
        return {'status': 'ok' if results else 'empty', 'results': results, 'error': None}
    except GoogleSERPBlockedError as e:
        return {'status': 'blocked', 'results': [], 'error': str(e), 'provider': 'google_scraping'}
    except Exception as e:
        return {'status': 'error', 'results': [], 'error': str(e)}


# --- HISTÓRICO DESDE EXCEL ---

def load_history(f):
    try:
        df_s = pd.read_excel(f, sheet_name='Estrategia')
        df_u = pd.read_excel(f, sheet_name='URLs')
        clusters = {}
        max_id = 0
        for _, r in df_s.iterrows():
            cid = r['Cluster ID']
            try:
                max_id = max(max_id, int(re.search(r'\d+', cid).group()))
            except Exception:
                pass
            if cid not in clusters:
                clusters[cid] = {
                    'id': cid,
                    'parent': '',
                    'children': [],
                    'urls_set': set(),
                    'serp_dump': [],
                    'analyzed': str(r.get('Avg Palabras', '-')) != '-',
                    'avg_words': r.get('Avg Palabras', '-'),
                    'avg_imgs': r.get('Avg Imágenes', '-'),
                    'top_structure': r.get('Estructura', '-'),
                    'entities': r.get('Entidades', '-'),
                    # Campos nuevos, si existen en el Excel se respetan
                    'own_urls': [],
                    'own_count': 0,
                    'coverage': r.get('Cobertura', '-') if 'Cobertura' in df_s.columns else '-',
                    'intent': r.get('Intención', '-') if 'Intención' in df_s.columns else '-'
                }
            if r['Rol'] == 'PADRE':
                clusters[cid]['parent'] = r['Keyword']
            else:
                clusters[cid]['children'].append(r['Keyword'])

        for _, r in df_u.iterrows():
            cid = r['Cluster ID']
            if cid in clusters:
                clusters[cid]['urls_set'].add(r['URL'])
                clusters[cid]['serp_dump'].append({
                    'url': r['URL'],
                    'title': r['Título'],
                    'rank': r['Rank']
                })

        return list(clusters.values()), max_id
    except Exception:
        return [], 0


# --- CLUSTERING LOGIC (REUSABLE) ---

def cluster_serp_results(serp_data_map: dict, strict_level: int = 3, target_domain: str = None, start_id: int = 1) -> list:
    """
    Agrupa keywords basado en overlap de SERP.
    serp_data_map: {keyword: [list of results]}
    strict_level: Nivel de coincidencia (def 3)
    target_domain: Dominio para calcular owned vs opportunity
    start_id: ID inicial para los grupos generados
    """
    final_clusters = []
    curr_id = start_id
    processed = set()

    # Sort keywords to have deterministic order
    keywords = sorted(serp_data_map.keys())

    for i, k1 in enumerate(keywords):
        if k1 in processed:
            continue

        res1 = serp_data_map.get(k1, [])
        urls1 = [r['url'] for r in res1]

        grp = {
            'id': f"G-{curr_id:03d}",
            'parent': k1,
            'children': [],
            'urls_set': set(urls1),
            'serp_dump': res1,
            'analyzed': False,
            'avg_words': '-',
            'avg_imgs': '-',
            'top_structure': '-',
            'entities': '-',
            # nuevos campos
            'own_urls': [],
            'own_count': 0,
            'coverage': '-',
            'intent': classify_intent(k1)
        }
        processed.add(k1)

        for k2 in keywords[i+1:]:
            if k2 in processed:
                continue

            res2 = serp_data_map.get(k2, [])
            urls2 = [r['url'] for r in res2]

            # Scoring logic (reused)
            score = 0
            for u in urls2:
                if u in urls1:
                    score += 1
                else:
                    d = get_domain(u)
                    if d and any(d in cu for cu in urls1):
                        score += 0.5

            ts = text_similarity(k1, k2)
            th = strict_level
            if ts > 0.85:
                th = max(1, th - 1)

            if score >= th:
                grp['children'].append(k2)
                # Merge serp dump
                for r in res2:
                    if not any(x['url'] == r['url'] for x in grp['serp_dump']):
                        grp['serp_dump'].append(r)
                        grp['urls_set'].add(r['url'])
                processed.add(k2)

        # Post-processing (Owned/Opportunity)
        target_domain_lower = (target_domain or '').lower()
        if target_domain_lower:
            own = []
            for item in grp.get('serp_dump', []):
                dom = get_domain(item.get('url', ''))
                if dom and target_domain_lower in dom:
                    own.append(item['url'])
            grp['own_urls'] = own
            grp['own_count'] = len(own)
            grp['coverage'] = 'OWNED' if grp['own_count'] > 0 else 'OPPORTUNITY'
        else:
            grp['own_urls'] = []
            grp['own_count'] = 0
            grp['coverage'] = '-'

        final_clusters.append(grp)
        curr_id += 1

    return final_clusters


# --- WORKER PRINCIPAL (CLUSTERING) ---

def worker(kws, file, cfg):
    """
    Proceso pesado:
    - Buscar SERPs
    - Clusterizar
    - Generar clusters nuevos
    - Actualizar monitor global
    """

    # Reset estado local y monitor global
    reset_global()
    update_status(
        active=True,
        progress=0,
        current_action='Iniciando motor...',
        results=[],
        logs=[],
        error=None,
        diagnostics={
            'keywords': {},
            'session': {
                'queries_total': 0,
                'queries_blocked': 0,
                'blocked_ratio': 0.0,
            }
        }
    )
    update_global("Cluster SEO", 0, "Iniciando motor...", active=True)

    try:
        final_clusters, max_id = ([], 0)
        existing_kws = set()
        if file:
            final_clusters, max_id = load_history(file)
            for c in final_clusters:
                if c.get('parent'):
                    existing_kws.add(c['parent'].lower())
                for child in c.get('children', []):
                    existing_kws.add(child.lower())

        new_data = {}
        kws_clean = []
        for k in kws:
            k_strip = k.strip()
            if k_strip and k_strip.lower() not in existing_kws:
                kws_clean.append(k_strip)

        total = len(kws_clean) or 1  # evitar división por 0

        # --- FASE 1: BÚSQUEDA (0-45%) ---
        for i, ckw in enumerate(kws_clean, start=1):
            current_pct = int((i / total) * 45)
            msg = f"Buscando: {ckw}"
            update_status(progress=current_pct, current_action=msg)
            update_global("Cluster SEO", current_pct, msg)

            dispatch_result = dispatcher(ckw, cfg)
            status = dispatch_result.get('status')
            res = dispatch_result.get('results', [])
            err = dispatch_result.get('error')
            diag = dispatch_result.get('diagnostics') or {}
            provider = dispatch_result.get('provider') or diag.get('provider') or 'unknown'
            http_status = diag.get('http_status')
            blocked = bool(diag.get('blocked') or status == 'blocked')
            results_count = diag.get('results_count', len(res or []))
            elapsed_ms = diag.get('elapsed_ms')

            with _status_lock:
                session_diag = job_status.setdefault('diagnostics', {}).setdefault('session', {
                    'queries_total': 0,
                    'queries_blocked': 0,
                    'blocked_ratio': 0.0,
                })
                session_diag['queries_total'] += 1
                if blocked:
                    session_diag['queries_blocked'] += 1
                total_q = max(1, session_diag['queries_total'])
                session_diag['blocked_ratio'] = round(session_diag['queries_blocked'] / total_q, 4)

            if status == 'blocked':
                cause = f"{provider}: bloqueo detectado (http={http_status or 'n/a'}, t={elapsed_ms or 'n/a'}ms)"
                append_log("⛔ Google bloqueó la consulta, prueba cookie o mayor delay", keyword=ckw, technical_cause=cause)
                new_data[ckw] = []
            elif status == 'error':
                cause = f"{provider}: {err or 'Error desconocido'}"
                append_log(f"⛔ Error técnico en SERP ({ckw}): {err or 'Error desconocido'}", keyword=ckw, technical_cause=cause)
                new_data[ckw] = []
            elif not res:
                cause = f"{provider}: sin resultados (http={http_status or 'n/a'}, parsed={results_count}, t={elapsed_ms or 'n/a'}ms)"
                append_log(f"⚠️ 0 resultados reales: {ckw}", keyword=ckw, technical_cause=cause)
                new_data[ckw] = []
            else:
                cause = f"{provider}: ok (http={http_status or 'n/a'}, parsed={results_count}, t={elapsed_ms or 'n/a'}ms)"
                append_log(f"✅ {ckw}: {len(res)} URLs", keyword=ckw, technical_cause=cause)
                new_data[ckw] = res if isinstance(res, list) else []

        # --- FASE 2: CLUSTERIZACIÓN CON HISTÓRICO (45-70%) ---
        msg_cluster = "Clusterizando con histórico..."
        update_status(current_action=msg_cluster, progress=55)
        update_global("Cluster SEO", 55, msg_cluster)

        unmatched = []

        for idx, kw in enumerate(kws_clean, start=1):
            res = new_data.get(kw, [])
            if not res:
                unmatched.append(kw)
                continue

            kw_urls = [r['url'] for r in res]
            matched = False

            for c in final_clusters:
                score = 0
                c_urls = list(c['urls_set'])
                for u in kw_urls:
                    if u in c_urls:
                        score += 1
                    else:
                        d = get_domain(u)
                        if d and any(d in cu for cu in c_urls):
                            score += 0.5

                ts = text_similarity(kw, c['parent'])
                th = cfg['strict']
                if ts > 0.85:
                    th = max(1, th - 1)

                if score >= th:
                    c['children'].append(kw)
                    for r in res:
                        if not any(x['url'] == r['url'] for x in c['serp_dump']):
                            c['serp_dump'].append(r)
                            c['urls_set'].add(r['url'])
                    matched = True
                    break

            if not matched:
                unmatched.append(kw)

        # --- FASE 3: NUEVOS GRUPOS (70-90%) ---
        msg_new = "Generando grupos nuevos..."
        update_status(current_action=msg_new, progress=70)
        update_global("Cluster SEO", 70, msg_new)

        # Prepare data for new clustering
        unmatched_data = {k: new_data.get(k, []) for k in unmatched}

        new_clusters = cluster_serp_results(
            serp_data_map=unmatched_data,
            strict_level=cfg['strict'],
            target_domain=cfg.get('target_domain'),
            start_id=max_id + 1
        )

        final_clusters.extend(new_clusters)

        # --- MARCAR COBERTURA POR DOMINIO OBJETIVO + INTENCIÓN ---
        target_domain = (cfg.get('target_domain') or '').lower()
        for c in final_clusters:
            # Intención si no la tenía (histórico)
            c.setdefault('intent', classify_intent(c.get('parent', '')))

            if target_domain:
                own = []
                for item in c.get('serp_dump', []):
                    dom = get_domain(item.get('url', ''))
                    if dom and target_domain in dom:
                        own.append(item['url'])
                c['own_urls'] = own
                c['own_count'] = len(own)
                c['coverage'] = 'OWNED' if c['own_count'] > 0 else 'OPPORTUNITY'
            else:
                c.setdefault('own_urls', [])
                c.setdefault('own_count', 0)
                c.setdefault('coverage', '-')

        # --- FASE FINAL (90-100%) ---
        final_msg = "Finalizado"
        update_status(
            results=final_clusters,
            progress=100,
            active=False,
            current_action=final_msg
        )
        update_global("Cluster SEO", 100, final_msg, active=False)

    except Exception as e:
        err_msg = str(e)
        update_status(error=err_msg, active=False, current_action="Error en proceso")
        update_global("Cluster SEO", 0, "Error en proceso", active=False)
        append_log(f"⛔ Error: {err_msg}")


# --- RUTAS ---

@seo_bp.route('/')
def index():
    return render_template('seo/dashboard.html')


@seo_bp.route('/start', methods=['POST'])
def start():
    # Evitar dos jobs simultáneos
    if job_status['active']:
        return jsonify({'status': 'busy'})

    def _to_bool(value, default=False):
        if value is None:
            return default
        return str(value).strip().lower() in ('1', 'true', 'yes', 'on')

    cfg = {
        'mode': request.form.get('mode'),
        'gl': request.form.get('gl'),
        'hl': request.form.get('hl'),
        'cookie': request.form.get('cookie'),

        # API Oficial params
        'google_cse_key': request.form.get('google_cse_key') or request.form.get('cse_key'),
        'google_cse_cx': request.form.get('google_cse_cx') or request.form.get('cse_cx'),

        # DataForSEO params (opcional, si no está en settings global)
        'dataforseo_login': request.form.get('dataforseo_login') or request.form.get('dfs_login'),
        'dataforseo_password': request.form.get('dataforseo_password') or request.form.get('dfs_pass'),

        'delay': float(request.form.get('delay', 3)),
        'tos': int(request.form.get('tos', 15)),
        'top_n': int(request.form.get('top_n', 10)),
        'strict': int(request.form.get('strict', 3)),
        'google_scraping_auto_fallback': _to_bool(request.form.get('google_scraping_auto_fallback'), False),
        'google_scraping_fallback_mode': request.form.get('google_scraping_fallback_mode', 'explicit_error'),
        'google_scraping_allow_ddg_fallback': _to_bool(request.form.get('google_scraping_allow_ddg_fallback'), False),

        # NUEVO: dominio objetivo (opcional)
        'target_domain': (request.form.get('target_domain') or '').strip().lower()
    }

    if cfg.get('mode') == 'dataforseo':
        dfs_credentials = resolve_dataforseo_credentials({
            'dataforseo_login': request.form.get('dataforseo_login') or request.form.get('dfs_login'),
            'dataforseo_password': request.form.get('dataforseo_password') or request.form.get('dfs_pass')
        })
        if not dfs_credentials.get('login') or not dfs_credentials.get('password'):
            return jsonify({'status': 'error', 'message': MISSING_DFS_CREDENTIALS_MESSAGE}), 400
        cfg['dataforseo_login'] = dfs_credentials['login']
        cfg['dataforseo_password'] = dfs_credentials['password']

    kws = request.form.get('keywords', '').split('\n')
    f = request.files.get('history_file')
    fb = f.read() if f else None

    t = threading.Thread(
        target=worker,
        args=(kws, io.BytesIO(fb) if fb else None, cfg),
        daemon=True
    )
    t.start()

    return jsonify({'status': 'ok'})


@seo_bp.route('/status')
def status():
    include_diagnostics = str(request.args.get('diagnostics', '')).strip().lower() in ('1', 'true', 'yes', 'on')
    clean_results = []
    # Solo enviamos los clusters completos si el job ya ha terminado,
    # para no mandar sets ni estructuras incompletas
    if not job_status['active']:
        for c in job_status['results']:
            cc = c.copy()
            cc.pop('urls_set', None)
            clean_results.append(cc)

    payload = {
        'active': job_status['active'],
        'progress': job_status['progress'],
        'current_action': job_status['current_action'],
        'logs': job_status['logs'],
        'results': clean_results,
        'error': job_status['error']
    }
    if include_diagnostics:
        payload['diagnostics'] = job_status.get('diagnostics', {})
    return jsonify(payload)


@seo_bp.route('/analyze_cluster', methods=['POST'])
def analyze_cluster():
    cid = request.json.get('id')
    target = next((c for c in job_status['results'] if c['id'] == cid), None)
    if target and target['serp_dump']:
        structs, ents, w, i, count = [], [], 0, 0, 0
        unique_urls = []
        seen = set()

        for item in target['serp_dump']:
            u = item['url']
            if u not in seen:
                unique_urls.append(u)
                seen.add(u)
            if len(unique_urls) >= 3:
                break

        for u in unique_urls:
            d = scrape_page(u)
            if d:
                count += 1
                w += d.get('words', 0)
                i += d.get('imgs', 0)
                structs.append(f"--- {u} ---")
                structs.extend(d.get('structure', [])[:15])
                ents.extend(d.get('entities', []))

        if count > 0:
            target.update({
                'avg_words': int(w / count),
                'avg_imgs': int(i / count),
                'top_structure': "\n".join(structs),
                'entities': ", ".join(list(set(ents))[:8]),
                'analyzed': True
            })
            r = target.copy()
            r.pop('urls_set', None)
            return jsonify({'status': 'ok', 'data': r})

    return jsonify({'status': 'error'})


@seo_bp.route('/analyze_bulk', methods=['POST'])
def analyze_bulk():
    """
    Analizador masivo:
    Devuelve:
      - url
      - title
      - h1
      - words
      - imgs
      - structure (h1–h3 formateados como texto)
      - headings (lista de encabezados)
      - entities
    """
    urls = request.json.get('urls', [])
    res = []

    for u in urls:
        if not u.strip():
            continue
        d = scrape_page(u.strip())
        if d:
            # structure: pasamos a string para el front actual
            d['structure'] = "\n".join(d.get('structure', [])[:20])
            res.append(d)
        else:
            res.append({
                'url': u,
                'title': '',
                'h1': '',
                'words': 0,
                'imgs': 0,
                'structure': 'Error',
                'headings': [],
                'entities': []
            })

    return jsonify({'status': 'ok', 'data': res})


@seo_bp.route('/download')
def download():
    data = job_status['results']
    r1, r2 = [], []

    for c in data:
        an = c.get('analyzed', False)
        r1.append({
            'Cluster ID': c.get('id'),
            'Rol': 'PADRE',
            'Keyword': c.get('parent'),
            'Avg Palabras': c.get('avg_words', '-') if an else '-',
            'Avg Imágenes': c.get('avg_imgs', '-') if an else '-',
            'Entidades': c.get('entities', '-') if an else '-',
            'Estructura': c.get('top_structure', '-') if an else '-',
            # NUEVO
            'Cobertura': c.get('coverage', '-'),
            'URLs Propias': ", ".join(c.get('own_urls', [])),
            'Intención': c.get('intent', '-')
        })

        for ch in c.get('children', []):
            r1.append({
                'Cluster ID': c.get('id'),
                'Rol': 'Variación',
                'Keyword': ch,
                'Avg Palabras': '-',
                'Avg Imágenes': '-',
                'Entidades': '-',
                'Estructura': '-',
                'Cobertura': '-',
                'URLs Propias': '',
                'Intención': c.get('intent', '-')
            })

        for u in c.get('serp_dump', []):
            r2.append({
                'Cluster ID': c.get('id'),
                'Padre': c.get('parent'),
                'Rank': u.get('rank'),
                'URL': u.get('url'),
                'Título': u.get('title')
            })

    o = io.BytesIO()
    with pd.ExcelWriter(o, engine='openpyxl') as w:
        pd.DataFrame(r1).to_excel(w, sheet_name='Estrategia', index=False)
        pd.DataFrame(r2).to_excel(w, sheet_name='URLs', index=False)
    o.seek(0)
    return send_file(o, download_name='seo_v17.xlsx', as_attachment=True)

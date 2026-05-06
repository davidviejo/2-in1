from flask import Blueprint, render_template, request, jsonify, send_file
import pandas as pd
import requests
from bs4 import BeautifulSoup
import time, io, threading, re, urllib.parse, math
from difflib import SequenceMatcher
from collections import Counter, defaultdict
import json

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
                'estimated_cost_total': 0.0,
                'actual_cost_total': 0.0,
                'last_execution_mode': None,
                'last_detail': None,
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

    # datos estructurados (Schema.org): JSON-LD y microdata
    schema_types = []
    schema_json_ld_count = 0
    schema_microdata_count = 0

    def _collect_schema_types(node):
        if isinstance(node, dict):
            stype = node.get('@type')
            if isinstance(stype, str):
                schema_types.append(stype)
            elif isinstance(stype, list):
                schema_types.extend([t for t in stype if isinstance(t, str)])
            for val in node.values():
                _collect_schema_types(val)
        elif isinstance(node, list):
            for item in node:
                _collect_schema_types(item)

    for script in soup.find_all('script', attrs={'type': 'application/ld+json'}):
        raw = (script.string or script.get_text() or '').strip()
        if not raw:
            continue
        try:
            payload = json.loads(raw)
        except Exception:
            continue
        schema_json_ld_count += 1
        _collect_schema_types(payload)

    # Conteo básico de microdata
    schema_microdata_count = len(soup.select('[itemscope]'))
    for tag in soup.select('[itemtype]'):
        itemtype = (tag.get('itemtype') or '').strip()
        if not itemtype:
            continue
        # suele venir como URL(s), extraemos el último segmento
        for raw_type in itemtype.split():
            t = raw_type.rstrip('/').split('/')[-1]
            if t:
                schema_types.append(t)

    schema_types_clean = sorted(set([t.strip() for t in schema_types if t and t.strip()]))[:30]

    return {
        'url': url,
        'title': page_title,
        'h1': h1_text,
        'words': word_count,
        'imgs': img_count,
        'structure': structure_lines,  # h1–h3 en forma de líneas de texto
        'headings': headings,          # h1–h3 como lista de dicts
        'entities': entities,
        'schema': {
            'json_ld_count': schema_json_ld_count,
            'microdata_count': schema_microdata_count,
            'total_blocks': schema_json_ld_count + schema_microdata_count,
            'types': schema_types_clean
        }
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


def _tokenize_tfidf_text(text: str):
    return [t for t in re.findall(r"[a-zA-ZáéíóúñüÁÉÍÓÚÑÜ]{3,}", (text or '').lower())]


def compute_semantic_tfidf(documents, top_k: int = 12):
    """Calcula términos semánticos con TF-IDF sin dependencias externas."""
    if not documents:
        return []

    stopwords = {
        'para', 'como', 'este', 'esta', 'desde', 'hasta', 'sobre', 'entre', 'donde', 'cuando',
        'tambien', 'porque', 'puede', 'pueden', 'tiene', 'tener', 'hacer', 'hacia', 'todos',
        'todas', 'cada', 'solo', 'ademas', 'muy', 'mas', 'menos', 'una', 'unas', 'unos', 'uno',
        'con', 'sin', 'por', 'del', 'las', 'los', 'que', 'sus', 'son', 'the', 'and', 'for', 'from',
        'you', 'your', 'our', 'not', 'are', 'was', 'have', 'has'
    }

    tokenized_docs = []
    doc_freq = Counter()

    for doc in documents:
        tokens = [t for t in _tokenize_tfidf_text(doc) if t not in stopwords]
        if not tokens:
            continue
        tokenized_docs.append(tokens)
        doc_freq.update(set(tokens))

    n_docs = len(tokenized_docs)
    if not n_docs:
        return []

    scores = Counter()
    for tokens in tokenized_docs:
        tf = Counter(tokens)
        total_tokens = len(tokens)
        for term, count in tf.items():
            tf_norm = count / max(total_tokens, 1)
            idf = 1.0 + (n_docs / (1 + doc_freq[term]))
            scores[term] += tf_norm * idf

    return [term for term, _ in scores.most_common(top_k)]




def _build_tfidf_term_scores(documents, *, min_df_ratio: float = 0.34, max_df_ratio: float = 0.95, top_k: int = 80):
    """Calcula TF-IDF robusto para detectar términos de cobertura competitiva."""
    tokenized_docs = []
    doc_freq = Counter()
    if not documents:
        return []

    stopwords = {
        'para', 'como', 'este', 'esta', 'desde', 'hasta', 'sobre', 'entre', 'donde', 'cuando',
        'tambien', 'porque', 'puede', 'pueden', 'tiene', 'tener', 'hacer', 'hacia', 'todos',
        'todas', 'cada', 'solo', 'ademas', 'muy', 'mas', 'menos', 'una', 'unas', 'unos', 'uno',
        'con', 'sin', 'por', 'del', 'las', 'los', 'que', 'sus', 'son', 'the', 'and', 'for', 'from',
        'you', 'your', 'our', 'not', 'are', 'was', 'have', 'has'
    }

    for doc in documents:
        tokens = [t for t in _tokenize_tfidf_text(doc) if t not in stopwords]
        if not tokens:
            continue
        tokenized_docs.append(tokens)
        doc_freq.update(set(tokens))

    n_docs = len(tokenized_docs)
    if not n_docs:
        return []

    min_df = max(1, int(n_docs * min_df_ratio))
    max_df = max(1, int(n_docs * max_df_ratio))

    scores = Counter()
    for tokens in tokenized_docs:
        tf = Counter(tokens)
        total_tokens = len(tokens)
        for term, count in tf.items():
            df = doc_freq.get(term, 0)
            if df < min_df or df > max_df:
                continue
            tf_norm = count / max(total_tokens, 1)
            idf = math.log((1 + n_docs) / (1 + df)) + 1
            scores[term] += tf_norm * idf

    ranked = []
    for term, score in scores.most_common(top_k):
        ranked.append({
            'term': term,
            'score': round(float(score), 6),
            'doc_frequency': int(doc_freq.get(term, 0)),
            'document_coverage_percent': round((doc_freq.get(term, 0) / n_docs) * 100, 2),
        })
    return ranked

BLOCK_PATTERNS = {
    "price": ["precio", "precios", "coste", "tarifa", "desde", "€", "eur", "price", "pricing", "cost", "from", "$", "plan"],
    "faq": ["preguntas frecuentes", "faq", "frequently asked", "common questions"],
    "reviews": ["reseñas", "opiniones", "valoraciones", "reviews", "ratings"],
    "testimonials": ["testimonios", "testimonials", "success stories"],
    "case_studies": ["caso de éxito", "casos de éxito", "case study", "case studies"],
    "cta": ["comprar", "reservar", "pedir cita", "solicitar presupuesto", "contactar", "llamar", "whatsapp", "obtener demo", "prueba gratis", "suscribirse", "añadir al carrito", "book", "buy", "contact", "call", "get quote", "request demo", "free trial", "add to cart"],
    "contact": ["contacto", "contactar", "call us", "contact us", "email", "correo"],
    "form": ["formulario", "submit", "request", "solicitar"],
    "guarantee": ["garantía", "garantizado", "devolución", "guarantee", "money back"],
    "author_or_team": ["autor", "sobre nosotros", "equipo", "author", "about us", "team"],
    "location": ["dirección", "ubicación", "mapa", "location", "address", "near me", "cerca de mí", "horario"],
    "process_steps": ["paso 1", "paso 2", "cómo funciona", "process", "step 1", "step 2"],
    "benefits": ["beneficios", "ventajas", "benefits", "advantages"],
    "comparison": ["comparativa", "vs", "versus", "alternativas", "mejores", "best", "alternatives"],
    "financing": ["financiación", "cuotas", "mensual", "financing", "monthly payment"],
}


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").lower()).strip()


def _extract_enriched_page_data(url: str):
    headers = {"User-Agent": "Mozilla/5.0 (compatible; SEO-Suite/1.1; +https://example.com)"}
    response = requests.get(url, headers=headers, timeout=20, allow_redirects=True)
    response.raise_for_status()
    soup = BeautifulSoup(response.text or "", 'html.parser')
    text_clean = _normalize_text(soup.get_text(separator=' '))
    base = scrape_page_local(url) or {}
    base.setdefault('schema', {'json_ld_count': 0, 'microdata_count': 0, 'total_blocks': 0, 'types': []})
    base.setdefault('headings', [])
    base.setdefault('entities', [])
    anchors = soup.find_all('a', href=True)
    final_host = urllib.parse.urlparse(response.url or url).netloc.lower()
    internal_links_count, external_links_count = 0, 0
    for a in anchors:
        parsed = urllib.parse.urlparse(urllib.parse.urljoin(response.url or url, a.get('href') or ''))
        if not parsed.netloc or parsed.netloc.lower() == final_host:
            internal_links_count += 1
        else:
            external_links_count += 1
    images = soup.find_all('img')
    without_alt = sum(1 for img in images if img.get('alt') is None)
    empty_alt = sum(1 for img in images if img.get('alt') is not None and not (img.get('alt') or '').strip())
    with_alt = max(len(images) - without_alt - empty_alt, 0)
    blocks = {}
    for block, pats in BLOCK_PATTERNS.items():
        hits, first = [], None
        for pat in pats:
            for m in re.finditer(re.escape(pat.lower()), text_clean):
                hits.append(pat)
                if first is None:
                    first = (m.start() / max(len(text_clean), 1)) * 100
        blocks[block] = {"present": bool(hits), "count": len(hits), "first_position_percent": round(first, 2) if first is not None else None, "signals": sorted(set(hits))[:8]}
    intent_scores = {"local": 3 if blocks["location"]["present"] else 0, "transactional": (3 if blocks["price"]["present"] else 0) + (3 if blocks["cta"]["present"] else 0), "informational": len(re.findall(r"\b(qué es|que es|cómo|como|guía|guide|how to|tutorial)\b", text_clean)), "commercial": int(blocks["reviews"]["present"]) + int(blocks["price"]["present"]) + int(blocks["guarantee"]["present"]), "comparison": 3 if blocks["comparison"]["present"] else 0, "navigational": len(re.findall(r"\b(login|contacto|soporte|support|área cliente|client area)\b", text_clean))}
    primary_intent = max(intent_scores, key=lambda k: intent_scores[k]) if any(intent_scores.values()) else "informational"
    page_type_scores = defaultdict(int)
    schema_types = [t.lower() for t in base["schema"].get("types", [])]
    page_type_scores["product_page"] += 3 if blocks["price"]["present"] and "product" in schema_types else 0
    page_type_scores["service_landing"] += 2 if blocks["cta"]["present"] and (blocks["contact"]["present"] or blocks["form"]["present"]) else 0
    page_type_scores["blog_article"] += 2 if "article" in schema_types else 0
    page_type_scores["pricing_page"] += 3 if blocks["price"]["count"] >= 2 else 0
    page_type_scores["comparison_page"] += 3 if blocks["comparison"]["present"] else 0
    page_type_scores["local_page"] += 3 if blocks["location"]["present"] and re.search(r"\b(\+?\d[\d\-\s]{7,})\b", text_clean) else 0
    page_type_scores["homepage"] += 2 if urllib.parse.urlparse(response.url or url).path in ("", "/") else 0
    page_type = max(page_type_scores, key=lambda k: page_type_scores[k]) if page_type_scores else "other"
    issues = []
    if not base.get("title"):
        issues.append({"id": "title_missing", "category": "content", "severity": "high", "message": "Falta title", "recommendation": "Añade una etiqueta title única y descriptiva.", "evidence": [url]})
    meta_description = (soup.find('meta', attrs={'name': re.compile(r'description', re.I)}) or {}).get('content', '')
    if not meta_description:
        issues.append({"id": "meta_description_missing", "category": "technical", "severity": "medium", "message": "Falta meta description", "recommendation": "Añade meta description orientada al CTR.", "evidence": [url]})
    h1_count = len(soup.find_all('h1'))
    if h1_count == 0:
        issues.append({"id": "h1_missing", "category": "structure", "severity": "high", "message": "Falta H1", "recommendation": "Incluye un H1 alineado con la intención.", "evidence": [url]})
    if h1_count > 1:
        issues.append({"id": "h1_multiple", "category": "structure", "severity": "medium", "message": "Múltiples H1", "recommendation": "Mantén un único H1 principal.", "evidence": [str(h1_count)]})
    technical_score = (20 if response.status_code == 200 else 0) + (10 if soup.find('link', rel=lambda x: x and 'canonical' in str(x).lower()) else 0) + (10 if soup.find('meta', attrs={'name': re.compile(r'robots', re.I)}) else 0) + (10 if meta_description else 0) + (10 if h1_count == 1 else 0)
    conversion_score = min(100, blocks["cta"]["count"] * 8 + blocks["contact"]["count"] * 6 + blocks["form"]["count"] * 6 + blocks["reviews"]["count"] * 5 + blocks["guarantee"]["count"] * 4)
    content_score = min(100, 20 + (10 if base.get("words", 0) > 400 else 0) + (10 if base.get("h1") else 0))
    structure_score = min(100, 20 + min(len(base.get("headings", [])) * 4, 40))
    semantic_score = min(100, 20 + min(len(base.get("entities", [])), 30))
    schema_score = min(100, 10 + base["schema"].get("json_ld_count", 0) * 8 + base["schema"].get("microdata_count", 0) * 4)
    local_score = min(100, 20 + blocks["location"]["count"] * 8) if intent_scores["local"] > 0 else 0
    seo_score = int((content_score + structure_score + semantic_score + schema_score + conversion_score + technical_score + (local_score or 0)) / (7 if local_score else 6))
    base.update({"technical": {"status_code": response.status_code, "final_url": response.url, "redirect_chain": [h.url for h in response.history] if response.history else [], "canonical": (soup.find('link', rel=lambda x: x and 'canonical' in str(x).lower()) or {}).get('href', ''), "meta_robots": (soup.find('meta', attrs={'name': re.compile(r'robots', re.I)}) or {}).get('content', ''), "x_robots_tag": response.headers.get('X-Robots-Tag', ''), "meta_description": meta_description, "hreflang_count": len(soup.find_all('link', attrs={'hreflang': True})), "open_graph_count": len(soup.find_all('meta', attrs={'property': re.compile(r'^og:', re.I)})), "twitter_card_count": len(soup.find_all('meta', attrs={'name': re.compile(r'^twitter:', re.I)})), "internal_links_count": internal_links_count, "external_links_count": external_links_count}, "images_analysis": {"total_images": len(images), "images_without_alt": without_alt, "images_empty_alt": empty_alt, "alt_coverage_percent": round((with_alt / max(len(images), 1)) * 100, 2), "duplicate_alt_count": 0, "lazy_loaded_images_count": sum(1 for img in images if (img.get('loading') or '').lower() == 'lazy')}, "blocks": blocks, "intent": {"primary_intent": primary_intent, "intent_scores": intent_scores}, "page_classification": {"page_type": page_type, "page_type_scores": dict(page_type_scores)}, "content_score": content_score, "structure_score": structure_score, "semantic_score": semantic_score, "schema_score": schema_score, "conversion_score": conversion_score, "technical_score": technical_score, "local_score": local_score, "seo_score": seo_score, "issues": issues})
    return base


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
                'estimated_cost_total': 0.0,
                'actual_cost_total': 0.0,
                'last_execution_mode': None,
                'last_detail': None,
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
                    'estimated_cost_total': 0.0,
                    'actual_cost_total': 0.0,
                    'last_execution_mode': None,
                    'last_detail': None,
                })
                session_diag['queries_total'] += 1
                if blocked:
                    session_diag['queries_blocked'] += 1
                total_q = max(1, session_diag['queries_total'])
                session_diag['blocked_ratio'] = round(session_diag['queries_blocked'] / total_q, 4)
                session_diag['estimated_cost_total'] = round(
                    float(session_diag.get('estimated_cost_total', 0.0)) + float(diag.get('estimated_cost') or 0.0),
                    4
                )
                session_diag['actual_cost_total'] = round(
                    float(session_diag.get('actual_cost_total', 0.0)) + float(diag.get('actual_cost') or 0.0),
                    4
                )
                if diag.get('execution_mode'):
                    session_diag['last_execution_mode'] = diag.get('execution_mode')
                if diag.get('detail'):
                    session_diag['last_detail'] = diag.get('detail')

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
        'dataforseo_detail': request.form.get('dataforseo_detail') or 'regular',
        'dataforseo_execution_mode': request.form.get('dataforseo_execution_mode') or 'standard',

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
        semantic_docs = []
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
                semantic_docs.append(' '.join(d.get('entities', [])))
                semantic_docs.append(' '.join(d.get('structure', [])))

        if count > 0:
            target.update({
                'avg_words': int(w / count),
                'avg_imgs': int(i / count),
                'top_structure': "\n".join(structs),
                'entities': ", ".join(list(set(ents))[:8]),
                'semantic_tfidf_terms': compute_semantic_tfidf(semantic_docs),
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
        d = None
        try:
            d = _extract_enriched_page_data(u.strip())
        except Exception:
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
                'entities': [],
                'schema': {'json_ld_count': 0, 'microdata_count': 0, 'total_blocks': 0, 'types': []},
                'technical': {'status_code': 0, 'final_url': '', 'redirect_chain': [], 'canonical': '', 'meta_robots': '', 'x_robots_tag': '', 'meta_description': '', 'hreflang_count': 0, 'open_graph_count': 0, 'twitter_card_count': 0, 'internal_links_count': 0, 'external_links_count': 0},
                'images_analysis': {'total_images': 0, 'images_without_alt': 0, 'images_empty_alt': 0, 'alt_coverage_percent': 0, 'duplicate_alt_count': 0, 'lazy_loaded_images_count': 0},
                'blocks': {k: {"present": False, "count": 0, "first_position_percent": None, "signals": []} for k in BLOCK_PATTERNS.keys()},
                'intent': {'primary_intent': 'informational', 'intent_scores': {'local': 0, 'transactional': 0, 'informational': 0, 'commercial': 0, 'comparison': 0, 'navigational': 0}},
                'page_classification': {'page_type': 'other', 'page_type_scores': {}},
                'content_score': 0, 'structure_score': 0, 'semantic_score': 0, 'schema_score': 0, 'conversion_score': 0, 'technical_score': 0, 'local_score': 0, 'seo_score': 0,
                'issues': [{'id': 'fetch_error', 'category': 'technical', 'severity': 'high', 'message': 'Error al extraer URL', 'recommendation': 'Verifica disponibilidad o bloqueos del sitio.', 'evidence': [u]}]
            })

    return jsonify({'status': 'ok', 'data': res})


@seo_bp.route('/compare_serp', methods=['POST'])
def compare_serp():
    payload = request.json or {}
    target_url = (payload.get('target_url') or '').strip()
    competitor_urls = [u.strip() for u in payload.get('competitor_urls', []) if str(u).strip()]
    if not target_url or not competitor_urls:
        return jsonify({'status': 'error', 'message': 'target_url y competitor_urls son obligatorios'}), 400
    target = _extract_enriched_page_data(target_url)
    competitors = []
    for u in competitor_urls:
        try:
            competitors.append(_extract_enriched_page_data(u))
        except Exception:
            continue
    if not competitors:
        return jsonify({'status': 'error', 'message': 'No se pudieron analizar competidores'}), 400
    avg_words = int(sum(c.get('words', 0) for c in competitors) / len(competitors))
    avg_images = int(sum(c.get('imgs', 0) for c in competitors) / len(competitors))
    avg_h2 = round(sum(len([h for h in c.get('headings', []) if h.get('tag') == 'H2']) for c in competitors) / len(competitors), 2)
    avg_h3 = round(sum(len([h for h in c.get('headings', []) if h.get('tag') == 'H3']) for c in competitors) / len(competitors), 2)
    common_blocks = {}
    gaps = {"blocks": [], "schema": [], "technical": [], "conversion": []}
    for block in BLOCK_PATTERNS.keys():
        cnt = sum(1 for c in competitors if c.get('blocks', {}).get(block, {}).get('present'))
        pct = round((cnt / len(competitors)) * 100, 2)
        common_blocks[block] = {"competitor_count": cnt, "competitor_percent": pct}
        if pct >= 50 and not target.get('blocks', {}).get(block, {}).get('present'):
            gaps["blocks"].append({"block": block, "severity": "high", "competitor_percent": pct, "target_present": False, "recommendation": f"Añade bloque de {block} visible y accionable."})
    comp_schema_types = Counter()
    for c in competitors:
        comp_schema_types.update(set(c.get('schema', {}).get('types', [])))
    for stype, cnt in comp_schema_types.items():
        pct = (cnt / len(competitors)) * 100
        if pct >= 50 and stype not in target.get('schema', {}).get('types', []):
            gaps["schema"].append({"schema_type": stype, "severity": "medium", "competitor_percent": round(pct, 2), "recommendation": f"Considera implementar schema {stype} si refleja contenido visible."})
    target_text = " ".join([
        target.get('title', ''),
        target.get('h1', ''),
        target.get('structure', ''),
        " ".join(target.get('entities', []) or []),
    ])
    competitor_docs = []
    for c in competitors:
        competitor_docs.append(" ".join([
            c.get('title', ''),
            c.get('h1', ''),
            c.get('structure', ''),
            " ".join(c.get('entities', []) or []),
        ]))

    competitor_terms = _build_tfidf_term_scores(competitor_docs, min_df_ratio=0.34, max_df_ratio=0.95, top_k=80)
    target_terms = _build_tfidf_term_scores([target_text], min_df_ratio=0.0, max_df_ratio=1.0, top_k=200)
    target_term_set = {t['term'] for t in target_terms}

    tfidf_gaps = []
    for term_data in competitor_terms:
        if term_data['term'] in target_term_set:
            continue
        sev = 'high' if term_data['document_coverage_percent'] >= 66 else 'medium'
        tfidf_gaps.append({
            'term': term_data['term'],
            'severity': sev,
            'competitor_coverage_percent': term_data['document_coverage_percent'],
            'competitor_score': term_data['score'],
            'recommendation': f"Añade el término '{term_data['term']}' en H2/H3, copy principal y FAQs si aplica a la intención.",
        })

    gaps['tfidf'] = tfidf_gaps[:25]

    recommendations = sorted(
        target.get("issues", [])
        + [{"id": f"gap_block_{g['block']}", "category": "competitive", "severity": g["severity"], "message": f"Gap en bloque {g['block']}", "recommendation": g["recommendation"], "evidence": [str(g["competitor_percent"])]} for g in gaps["blocks"]]
        + [{"id": f"gap_tfidf_{x['term']}", "category": "semantic", "severity": x["severity"], "message": f"Término semántico ausente: {x['term']}", "recommendation": x["recommendation"], "evidence": [str(x["competitor_coverage_percent"]), str(x["competitor_score"])]} for x in gaps['tfidf'][:12]],
        key=lambda x: {"critical": 0, "high": 1, "medium": 2, "low": 3}.get(x.get("severity", "low"), 4)
    )
    return jsonify({"status": "ok", "target": target, "competitors": competitors, "serp_summary": {"avg_words": avg_words, "avg_images": avg_images, "avg_h2": avg_h2, "avg_h3": avg_h3, "common_blocks": common_blocks, "competitor_tfidf_terms": competitor_terms[:20]}, "gaps": gaps, "recommendations": recommendations})


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

import time
import random
import threading
import asyncio
import requests
import atexit
import logging
import base64
import hashlib
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright
import urllib.parse
from typing import List, Dict, Optional, Any, Union
from flask import session, has_request_context
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from concurrent.futures import ThreadPoolExecutor
from apps.web.blueprints.usage_tracker import increment_api_usage
from apps.core.config import Config
from apps.tools.utils import is_safe_url, sanitize_log_message

class GoogleAPIError(Exception):
    pass


class GoogleSERPBlockedError(Exception):
    """Señal controlada para indicar bloqueo/captcha en la SERP."""
    pass

# --- ROBUST SCRAPING SESSION ---
def create_robust_session() -> requests.Session:
    """
    Creates a robust reusable requests Session with automatic retries for server errors
    and timeouts.
    """
    session = requests.Session()

    # Configure retry strategy
    retry_strategy = Retry(
        total=5,
        backoff_factor=1,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET", "HEAD"]
    )

    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    return session

# Global reusable session
robust_session = create_robust_session()

CANONICAL_SERP_KEYS = (
    'serp_provider',
    'dataforseo_login',
    'dataforseo_password',
    'google_cse_key',
    'google_cse_cx',
)


def normalize_serp_config(config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Normaliza configuración SERP para usar un contrato canónico interno, manteniendo
    compatibilidad con aliases legacy.
    """
    raw_cfg = dict(config or {})
    normalized = dict(raw_cfg)

    # DataForSEO aliases
    normalized['dataforseo_login'] = (
        raw_cfg.get('dataforseo_login')
        or raw_cfg.get('dfs_login')
        or raw_cfg.get('login')
    )
    normalized['dataforseo_password'] = (
        raw_cfg.get('dataforseo_password')
        or raw_cfg.get('dataforseo_pass')
        or raw_cfg.get('dfs_pass')
        or raw_cfg.get('password')
    )

    # Google CSE aliases
    normalized['google_cse_key'] = (
        raw_cfg.get('google_cse_key')
        or raw_cfg.get('cse_key')
        or raw_cfg.get('key')
    )
    normalized['google_cse_cx'] = (
        raw_cfg.get('google_cse_cx')
        or raw_cfg.get('cse_cx')
        or raw_cfg.get('cx')
    )

    provider = raw_cfg.get('serp_provider') or raw_cfg.get('provider')
    mode = raw_cfg.get('mode')

    if provider == 'google_api_official':
        provider = 'google_official'
    if mode == 'google_api_official':
        mode = 'google_official'

    normalized['serp_provider'] = provider
    normalized['mode'] = mode
    return normalized


def get_optimized_headers(cookie: Optional[str] = None, user_agent: Optional[str] = None) -> Dict[str, str]:
    """
    Genera cabeceras HTTP optimizadas para simular un navegador real.

    Args:
        cookie (str, optional): Cookie personalizada para la petición.

    Returns:
        dict: Diccionario de cabeceras incluyendo User-Agent y cookies.
    """
    headers = {
        'User-Agent': user_agent or random.choice(Config.USER_AGENTS),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0'
    }
    if cookie:
        headers['Cookie'] = cookie
    elif Config.DEFAULT_COOKIE:
        # Cookie mínima de consentimiento
        headers['Cookie'] = Config.DEFAULT_COOKIE
    return headers

def _extract_google_redirect_target(raw_href: str) -> str:
    if not raw_href:
        return ""

    href = raw_href.strip()
    if href.startswith('/url?'):
        parsed = urllib.parse.urlparse(href)
        q = urllib.parse.parse_qs(parsed.query)
        target = (q.get('q') or q.get('url') or [""])[0]
        return urllib.parse.unquote(target) if target else ""
    return href


def _canonicalize_result_url(raw_href: str) -> str:
    candidate = _extract_google_redirect_target(raw_href)
    if not candidate:
        return ""

    parsed = urllib.parse.urlparse(candidate)
    if parsed.scheme not in {"http", "https"}:
        return ""
    if not parsed.netloc:
        return ""

    host = parsed.netloc.lower()
    if host.startswith("www."):
        host = host[4:]
    if "google." in host:
        return ""

    blocked_tracking_params = {
        "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
        "gclid", "gbraid", "wbraid", "fbclid", "ved", "ei", "sa", "usg"
    }
    filtered_query = [
        (k, v)
        for k, v in urllib.parse.parse_qsl(parsed.query, keep_blank_values=True)
        if k.lower() not in blocked_tracking_params
    ]

    canonical = urllib.parse.urlunparse((
        parsed.scheme.lower(),
        host,
        parsed.path.rstrip('/'),
        '',
        urllib.parse.urlencode(filtered_query, doseq=True),
        ''
    ))
    return canonical


def parse_google_html(html_content: str) -> Union[List[Dict[str, str]], Dict[str, str]]:
    """
    Analiza el HTML de una página de resultados de Google (SERP) para extraer URLs y títulos.

    Args:
        html_content (str): El contenido HTML de la SERP.

    Returns:
        list|dict: Lista de resultados orgánicos o {"status":"blocked"} si hay captcha/bloqueo.
    """
    blocked_markers = (
        "sorry",
        "unusual traffic",
        "detected unusual traffic",
        "our systems have detected unusual traffic",
        "recaptcha",
    )
    lowered_html = (html_content or "").lower()
    if any(marker in lowered_html for marker in blocked_markers):
        return {"status": "blocked"}

    soup = BeautifulSoup(html_content, 'html.parser')
    results: List[Dict[str, str]] = []
    seen_urls = set()

    def append_result(raw_href: str, title: str) -> None:
        canonical_url = _canonicalize_result_url(raw_href)
        if not canonical_url or canonical_url in seen_urls:
            return
        clean_title = (title or "").strip()
        if not clean_title:
            return
        results.append({"url": canonical_url, "title": clean_title})
        seen_urls.add(canonical_url)

    # INTENTO 1: Orgánico moderno (contenedores principales de resultado).
    modern_containers = soup.select("div#search div.MjjYud, div#search div.g, div#rso div.MjjYud, div#rso div.g")
    for container in modern_containers:
        if container.select_one(
            ".ULSxyf, .xpdopen, .kp-wholepage, .V3FYCf, .commercial-unit-desktop-top, "
            ".related-question-pair, [data-init-vis=true]"
        ):
            continue
        if container.find_parent(attrs={"data-hveid": True}) and container.select_one(".related-question-pair"):
            continue
        anchor_tag = container.select_one("a[href]")
        header_tag = container.select_one("h3")
        if anchor_tag and header_tag:
            append_result(anchor_tag.get("href", ""), header_tag.get_text(strip=True))

    # INTENTO 2: Selectores Legacy (Para modo GBV=1 / Sin cookies)
    if not results:
        legacy_containers = soup.select("div#main div.g, div#main .kCrYT, div.ZINbbc")
        for container in legacy_containers:
            anchor_tag = container.select_one("a[href^='/url?'], a[href^='http']")
            if not anchor_tag:
                continue
            title_tag = container.select_one("h3") or container.select_one("div.BNeawe") or anchor_tag.select_one("span")
            if title_tag:
                append_result(anchor_tag.get("href", ""), title_tag.get_text(strip=True))

    # INTENTO 3: Enlaces limpios de respaldo solo en zona orgánica (#search/#rso).
    if not results:
        organic_root = soup.select_one("div#search") or soup.select_one("div#rso") or soup
        for anchor_tag in organic_root.select("a[href]"):
            href = anchor_tag.get("href", "")
            if not (href.startswith("/url?") or href.startswith("http")):
                continue
            if any(x in href for x in ("/aclk?", "/imgres?", "/search?", "/maps?")):
                continue
            if anchor_tag.find_parent(class_=["related-question-pair", "ULSxyf", "xpdopen"]):
                continue
            title_tag = anchor_tag.find("h3") or anchor_tag.find("span")
            if title_tag:
                append_result(href, title_tag.get_text(strip=True))

    return results

def scrape_google_serp(
    keyword: str,
    num_results: int = 10,
    delay: Union[int, float] = 2,
    cookie: Optional[str] = None,
    tos: int = 15,
    gl: str = "es",
    hl: str = "es",
    user_agent: Optional[str] = None,
    return_meta: bool = False,
) -> Union[List[Dict[str, str]], str, Dict[str, Any]]:
    """
    Realiza un scraping de la SERP de Google para una palabra clave dada.

    Args:
        keyword (str): Palabra clave a buscar.
        num_results (int): Número aproximado de resultados deseados.
        delay (int/float): Tiempo de espera antes de la petición para evitar bloqueos.
        cookie (str, optional): Cookie de sesión de Google.
        tos (int): Tiempo de espera máximo para la petición (timeout).
        gl (str): Geolocalización de Google (country code).
        hl (str): Idioma de la interfaz y resultados.

    Returns:
        list: Lista de resultados o cadena "BLOCKED" si se detecta bloqueo 429.
    """
    started_at = time.perf_counter()
    mode = "with_cookie" if cookie else "gbv_legacy"
    http_status: Optional[int] = None
    blocked = False

    try:
        time.sleep(float(delay))
        url = "https://www.google.com/search"

        params = {
            'q': keyword,
            'num': num_results + 5,
            'hl': hl,
            'gl': gl,
            'pws': '0',
            'filter': '0'
        }

        if not cookie:
            params['gbv'] = '1'

        response = requests.get(
            url,
            params=params,
            headers=get_optimized_headers(cookie, user_agent=user_agent),
            timeout=int(tos)
        )
        http_status = response.status_code

        if response.status_code == 429:
            blocked = True
            logging.warning(
                "Google SERP blocked keyword=%s mode=%s status=%s parsed=%s",
                sanitize_log_message(keyword),
                mode,
                response.status_code,
                0
            )
            if return_meta:
                return {
                    "results": [],
                    "http_status": http_status,
                    "blocked": blocked,
                    "mode": mode,
                    "elapsed_ms": int((time.perf_counter() - started_at) * 1000),
                }
            return "BLOCKED"

        if response.status_code == 200:
            parsed = parse_google_html(response.text)
            if isinstance(parsed, dict) and parsed.get("status") == "blocked":
                blocked = True
                logging.warning(
                    "Google SERP blocked keyword=%s mode=%s status=%s parsed=%s",
                    sanitize_log_message(keyword),
                    mode,
                    response.status_code,
                    0
                )
                if return_meta:
                    return {
                        "results": [],
                        "http_status": http_status,
                        "blocked": blocked,
                        "mode": mode,
                        "elapsed_ms": int((time.perf_counter() - started_at) * 1000),
                    }
                return "BLOCKED"

            parsed_results = parsed[:num_results]
            logging.info(
                "Google SERP parsed keyword=%s mode=%s status=%s parsed=%s",
                sanitize_log_message(keyword),
                mode,
                response.status_code,
                len(parsed_results)
            )
            if return_meta:
                return {
                    "results": parsed_results,
                    "http_status": http_status,
                    "blocked": blocked,
                    "mode": mode,
                    "elapsed_ms": int((time.perf_counter() - started_at) * 1000),
                }
            return parsed_results

        logging.info(
            "Google SERP no-parse keyword=%s mode=%s status=%s parsed=%s",
            sanitize_log_message(keyword),
            mode,
            response.status_code,
            0
        )

    except Exception:
        logging.error("Request failed during Google SERP scrape", exc_info=True)

    fallback = {
        "results": [],
        "http_status": http_status,
        "blocked": blocked,
        "mode": mode,
        "elapsed_ms": int((time.perf_counter() - started_at) * 1000),
    }
    return fallback if return_meta else []


def search_ddg(keyword: str, num_results: int = 10, lang: str = 'es') -> List[Dict[str, Any]]:
    results: List[Dict[str, Any]] = []
    try:
        from ddgs import DDGS
        with DDGS() as ddgs:
            region = "es-es" if "es" in lang.lower() else "us-en"
            for r in ddgs.text(keyword, region=region, max_results=num_results + 5):
                results.append({
                    'url': r.get('href'),
                    'title': r.get('title'),
                    'snippet': r.get('body', ''),
                    'rank': len(results) + 1
                })
                if len(results) >= num_results:
                    break
    except Exception as e:
        logging.error(f"Smart Search DDG Fallback Error: {e}")
        return []
    return results[:num_results]


def _run_google_scraping_with_policy(
    keyword: str,
    cfg: Dict[str, Any],
    num_results: int,
    lang: str,
    country: str
) -> Dict[str, Any]:
    cookie = cfg.get('cookie')
    delay = cfg.get('delay', 2)
    primary_ua = random.choice(Config.USER_AGENTS)
    res_meta = scrape_google_serp(
        keyword,
        num_results,
        delay,
        cookie=cookie,
        gl=country,
        hl=lang,
        user_agent=primary_ua,
        return_meta=True
    )
    res = res_meta.get('results', [])

    if isinstance(res, list) and not res_meta.get('blocked'):
        for r in res:
            if 'snippet' not in r:
                r['snippet'] = ''
        return {
            "status": "ok" if res else "empty",
            "results": res,
            "provider": "google_scraping",
            "http_status": res_meta.get('http_status'),
            "blocked": bool(res_meta.get('blocked')),
            "elapsed_ms": res_meta.get('elapsed_ms'),
            "mode": res_meta.get('mode'),
        }

    if not res_meta.get('blocked'):
        return {
            "status": "error",
            "results": [],
            "provider": "google_scraping",
            "http_status": res_meta.get('http_status'),
            "blocked": False,
            "elapsed_ms": res_meta.get('elapsed_ms'),
            "mode": res_meta.get('mode'),
        }

    ux_msg = "Google bloqueó la consulta, prueba cookie o mayor delay"
    logging.warning("%s | keyword=%s", ux_msg, sanitize_log_message(keyword))

    auto_fallback = bool(cfg.get('google_scraping_auto_fallback', Config.GOOGLE_SCRAPING_AUTO_FALLBACK))
    fallback_mode = (cfg.get('google_scraping_fallback_mode') or Config.GOOGLE_SCRAPING_FALLBACK_MODE or 'explicit_error').lower()
    allow_ddg = bool(cfg.get('google_scraping_allow_ddg_fallback', Config.ENABLE_DDG_FALLBACK))

    if auto_fallback and fallback_mode == 'retry':
        min_jitter = float(cfg.get('google_scraping_retry_min_jitter', Config.GOOGLE_SCRAPING_RETRY_MIN_JITTER))
        max_jitter = float(cfg.get('google_scraping_retry_max_jitter', Config.GOOGLE_SCRAPING_RETRY_MAX_JITTER))
        jitter = random.uniform(min_jitter, max_jitter)
        time.sleep(jitter)
        alternative_uas = [ua for ua in Config.USER_AGENTS if ua != primary_ua]
        retry_ua = random.choice(alternative_uas) if alternative_uas else primary_ua
        retry_meta = scrape_google_serp(
            keyword,
            num_results,
            0,
            cookie=cookie,
            gl=country,
            hl=lang,
            user_agent=retry_ua,
            return_meta=True
        )
        retry_res = retry_meta.get('results', [])
        if isinstance(retry_res, list) and not retry_meta.get('blocked'):
            for r in retry_res:
                if 'snippet' not in r:
                    r['snippet'] = ''
            return {
                "status": "ok" if retry_res else "empty",
                "results": retry_res,
                "provider": "google_scraping_retry",
                "http_status": retry_meta.get('http_status'),
                "blocked": bool(retry_meta.get('blocked')),
                "elapsed_ms": retry_meta.get('elapsed_ms'),
                "mode": retry_meta.get('mode'),
            }

    if auto_fallback and fallback_mode == 'ddg' and allow_ddg:
        ddg_results = search_ddg(keyword, num_results=num_results, lang=lang)
        if ddg_results:
            return {"status": "ok", "results": ddg_results, "provider": "ddg_fallback", "http_status": None, "blocked": False, "elapsed_ms": None, "mode": "ddg_fallback"}
        return {"status": "empty", "results": [], "provider": "ddg_fallback", "http_status": None, "blocked": False, "elapsed_ms": None, "mode": "ddg_fallback"}

    raise GoogleSERPBlockedError(ux_msg)

# --- GOOGLE API OFICIAL ---
def search_google_official(keyword: str, api_key: str, cx: str, num_results: int = 10, gl: str = 'es', hl: str = 'es', raise_on_error: bool = False) -> List[Dict[str, Any]]:
    results: List[Dict[str, Any]] = []
    try:
        start_index = 1
        while len(results) < num_results:
            if start_index > 91: break

            # INCREMENTAR CONTADOR AQUÍ
            # Cada llamada a la API cuenta, aunque devuelva error o 0 resultados
            increment_api_usage(1)

            params = {'key': api_key, 'cx': cx, 'q': keyword, 'num': 10, 'start': start_index, 'gl': gl, 'hl': hl}
            response = requests.get("https://www.googleapis.com/customsearch/v1", params=params, timeout=10)
            data = response.json()

            if 'error' in data:
                msg = data['error']['message']

                # Traducción de errores comunes para usuarios
                if "Custom Search JSON API" in msg:
                    msg = "Error: El proyecto de Google Cloud no tiene habilitada la API 'Custom Search JSON API'. Por favor habilítala en la consola de Google Cloud."
                elif "Daily Limit Exceeded" in msg or "quota" in msg.lower():
                    msg = "Error: Se ha superado la cuota diaria de la API de Google."

                logging.error(f"Google API Error: {msg}")
                if raise_on_error:
                    raise GoogleAPIError(msg)
                return []

            if 'items' in data:
                for item in data['items']:
                    results.append({'url': item['link'], 'title': item.get('title', 'Sin título'), 'snippet': item.get('snippet', ''), 'rank': len(results)+1})
                    if len(results) >= num_results: break
            else: break
            start_index += 10
    except Exception as e:
        if isinstance(e, GoogleAPIError):
            raise e
        logging.error(f"Google Official Search Exception: {sanitize_log_message(str(e))}")
        return []
    return results[:num_results]

# --- DATAFORSEO API ---
def search_dataforseo(keyword: str, login: str, passw: str, num_results: int = 10, lang: str = 'es', country: str = 'es') -> List[Dict[str, Any]]:
    results = []
    try:
        increment_api_usage(1)
        url = "https://api.dataforseo.com/v3/serp/google/organic/live/advanced"

        # Mapeo simple de país. DataForSEO usa location_code o location_name.
        # Por defecto usamos 'Spain' si es 'es'.
        location_name = "Spain"
        if country.lower() in ['us', 'en', 'usa', 'united states']: location_name = "United States"
        elif country.lower() in ['fr', 'france']: location_name = "France"
        elif country.lower() in ['de', 'germany']: location_name = "Germany"
        elif country.lower() in ['it', 'italy']: location_name = "Italy"
        # Se puede extender según necesidad

        # Codificar keyword en base64 - NO NECESARIO PARA ESTE ENDPOINT
        auth_b64 = base64.b64encode(f"{login}:{passw}".encode('utf-8')).decode('utf-8')

        payload = [{
            "keyword": keyword,
            "language_code": lang[:2],
            "location_name": location_name,
            "depth": max(10) # DataForSEO cuenta todos los elementos. Un depth bajo puede omitir orgánicos.
        }]

        headers = {
            'Authorization': f"Basic {auth_b64}",
            'Content-Type': 'application/json'
        }

        response = requests.post(url, json=payload, headers=headers, timeout=60)
        data = response.json()

        if data.get('status_code') == 20000:
            for task in data.get('tasks', []):
                if task.get('result') and task['result'][0].get('items'):
                    for item in task['result'][0]['items']:
                        if item.get('type') == 'organic':
                            results.append({
                                'url': item.get('url'),
                                'title': item.get('title', 'Sin título'),
                                'snippet': item.get('description', ''),
                                'rank': item.get('rank_group', 0)
                            })
                            if len(results) >= num_results: break
        else:
            logging.error(f"DataForSEO Error: {data.get('status_message')}")

    except Exception as e:
        logging.error(f"DataForSEO Exception: {sanitize_log_message(str(e))}")

    return results[:num_results]

# --- SERPAPI ---
def search_serpapi(keyword: str, api_key: str, num_results: int = 10, gl: str = 'es', hl: str = 'es') -> List[Dict[str, Any]]:
    """
    Realiza una búsqueda en Google usando SerpApi.
    """
    results = []
    try:
        increment_api_usage(1)
        url = "https://serpapi.com/search"

        # Ajuste de dominio de Google según país
        google_domain = "google.es"
        if gl.lower() in ['us', 'en', 'usa', 'united states']: google_domain = "google.com"
        elif gl.lower() in ['fr', 'france']: google_domain = "google.fr"
        elif gl.lower() in ['de', 'germany']: google_domain = "google.de"
        elif gl.lower() in ['it', 'italy']: google_domain = "google.it"
        elif gl.lower() in ['uk', 'united kingdom']: google_domain = "google.co.uk"

        params = {
            "engine": "google",
            "q": keyword,
            "api_key": api_key,
            "num": num_results + 5,
            "gl": gl,
            "hl": hl,
            "google_domain": google_domain
        }

        response = requests.get(url, params=params, timeout=30)
        data = response.json()

        if "error" in data:
            logging.error(f"SerpApi Error: {data['error']}")
            return []

        if "organic_results" in data:
            for item in data["organic_results"]:
                results.append({
                    'url': item.get('link'),
                    'title': item.get('title', 'Sin título'),
                    'snippet': item.get('snippet', ''),
                    'rank': item.get('position', len(results)+1)
                })
                if len(results) >= num_results: break
    except Exception as e:
        logging.error(f"SerpApi Exception: {sanitize_log_message(str(e))}")

    return results[:num_results]

# --- UNIFIED SMART SEARCH ---
def smart_serp_search(keyword: str, config: Optional[Dict] = None, num_results: int = 10, lang: str = 'es', country: str = 'es') -> Union[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Función de búsqueda unificada que selecciona el mejor proveedor disponible.
    Prioriza DataForSEO si está configurado globalmente, o respeta el modo explícito.

    Args:
        keyword (str): Keyword a buscar.
        config (dict): Configuración que puede venir del request (mode, keys, cookies).
        num_results (int): Cantidad de resultados.

    Returns:
        List[Dict]: Lista de resultados estandarizada [{'url':..., 'title':..., 'snippet':...}]
    """
    cfg = normalize_serp_config(config)

    # Fallback chain único: config explícita -> sesión -> DB
    if has_request_context():
        fallback_from_session = {
            'dataforseo_login': session.get('dataforseo_login'),
            'dataforseo_password': session.get('dataforseo_password') or session.get('dataforseo_pass'),
            'google_cse_key': session.get('google_cse_key'),
            'google_cse_cx': session.get('google_cse_cx'),
            'cookie': session.get('scraping_cookie'),
            'serpapi_key': session.get('serpapi_key'),
            'serp_provider': session.get('serp_provider'),
        }
        for key, value in fallback_from_session.items():
            if not cfg.get(key) and value:
                cfg[key] = value

    try:
        from apps.core.database import get_user_settings
        settings = get_user_settings('default') or {}
        fallback_from_db = {
            'dataforseo_login': settings.get('dataforseo_login'),
            'dataforseo_password': settings.get('dataforseo_password'),
            'google_cse_key': settings.get('google_cse_key'),
            'google_cse_cx': settings.get('google_cse_cx'),
            'cookie': settings.get('scraping_cookie'),
            'serpapi_key': settings.get('serpapi_key'),
            'serp_provider': settings.get('serp_provider'),
        }
        for key, value in fallback_from_db.items():
            if not cfg.get(key) and value:
                cfg[key] = value
    except Exception as e:
        logging.error(f"Error loading settings for smart_serp_search: {e}")

    cfg = normalize_serp_config(cfg)
    mode = cfg.get('mode')
    provider = cfg.get('serp_provider')
    return_diagnostics = bool(cfg.get('return_diagnostics'))

    def _keyword_hash(raw_keyword: str) -> str:
        return hashlib.sha256((raw_keyword or "").encode("utf-8")).hexdigest()[:16]

    def _return(
        results: List[Dict[str, Any]],
        status: str = 'ok',
        provider_name: Optional[str] = None,
        diagnostics: Optional[Dict[str, Any]] = None
    ):
        event = {
            "mode": diagnostics.get('mode') if diagnostics and diagnostics.get('mode') else (mode or 'auto'),
            "keyword_hash": _keyword_hash(keyword),
            "http_status": diagnostics.get('http_status') if diagnostics else None,
            "blocked": bool(diagnostics.get('blocked')) if diagnostics else False,
            "results_count": len(results or []),
            "elapsed_ms": diagnostics.get('elapsed_ms') if diagnostics else None,
        }
        logging.info("SERP_EVENT %s", event)

        if return_diagnostics:
            return {
                "status": status,
                "results": results,
                "provider": provider_name,
                "diagnostics": {
                    **event,
                    "provider": provider_name,
                },
            }
        return results

    # --- 1. MODO EXPLÍCITO (Prioridad Máxima por argumento) ---
    if mode == 'serpapi' and cfg.get('serpapi_key'):
        return _return(search_serpapi(keyword, cfg['serpapi_key'], num_results, gl=country, hl=lang), provider_name='serpapi')

    if mode == 'dataforseo' and cfg.get('dataforseo_login') and cfg.get('dataforseo_password'):
        return _return(search_dataforseo(keyword, cfg['dataforseo_login'], cfg['dataforseo_password'], num_results, lang, country), provider_name='dataforseo')

    if mode == 'google_official':
         api_key = cfg.get('google_cse_key')
         cx = cfg.get('google_cse_cx')
         if api_key and cx:
            return _return(search_google_official(keyword, api_key, cx, num_results, gl=country, hl=lang), provider_name='google_official')

    if mode in ['google_scraping', 'google_nuclear']:
         handled = _run_google_scraping_with_policy(keyword, cfg, num_results, lang, country)
         return _return(handled['results'], status=handled['status'], provider_name=handled.get('provider'), diagnostics=handled)

    # --- 2. SELECTOR DE PROVEEDOR GLOBAL (Si no hay modo explícito) ---
    if not mode or mode == 'auto':
        # SerpApi Preference
        if provider == 'serpapi' and cfg.get('serpapi_key'):
            return _return(search_serpapi(keyword, cfg['serpapi_key'], num_results, gl=country, hl=lang), provider_name='serpapi')

        # DataForSEO Preference
        if provider == 'dataforseo' and cfg.get('dataforseo_login') and cfg.get('dataforseo_password'):
             return _return(search_dataforseo(keyword, cfg['dataforseo_login'], cfg['dataforseo_password'], num_results, lang, country), provider_name='dataforseo')

        # Google Official Preference
        if provider == 'google_official':
             api_key = cfg.get('google_cse_key')
             cx = cfg.get('google_cse_cx')
             if api_key and cx:
                return _return(search_google_official(keyword, api_key, cx, num_results, gl=country, hl=lang), provider_name='google_official')

        # Google Scraping Preference
        if provider == 'google_scraping':
             handled = _run_google_scraping_with_policy(keyword, cfg, num_results, lang, country)
             return _return(handled['results'], status=handled['status'], provider_name=handled.get('provider'), diagnostics=handled)

    # --- 3. FALLBACKS AUTOMÁTICOS (Legacy logic) ---

    # 3.1 DataForSEO (Si hay credenciales en config/sesión)
    dfs_login = cfg.get('dataforseo_login') or Config.DATAFORSEO_LOGIN
    dfs_pass = cfg.get('dataforseo_password') or Config.DATAFORSEO_PASSWORD

    if dfs_login and dfs_pass:
        return _return(search_dataforseo(keyword, dfs_login, dfs_pass, num_results, lang, country), provider_name='dataforseo')

    # 3.2 Google API Oficial
    api_key = cfg.get('google_cse_key')
    cx = cfg.get('google_cse_cx')

    if api_key and cx:
        return _return(search_google_official(keyword, api_key, cx, num_results, gl=country, hl=lang), provider_name='google_official')

    # 3.3 DuckDuckGo (Fallback final)
    try:
        return _return(search_ddg(keyword, num_results=num_results, lang=lang), provider_name='ddg')
    except Exception as e:
        logging.error(f"Smart Search DDG Fallback Error: {e}")
        return _return([], status='error')


# --- BROWSER MANAGEMENT ---
# NOTE: Use Async Playwright in an isolated thread/loop to avoid
# "Playwright Sync API inside the asyncio loop" runtime errors.
_PLAYWRIGHT_LOCK = threading.Lock()

def cleanup_browser() -> None:
    """No-op cleanup kept for backward compatibility with existing callers/tests."""
    return None

atexit.register(cleanup_browser)

def _run_async_playwright(url: str) -> str:
    async def _runner() -> str:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            try:
                page = await browser.new_page()
                try:
                    await page.goto(url, timeout=20000)
                    return await page.content()
                finally:
                    await page.close()
            finally:
                await browser.close()

    with _PLAYWRIGHT_LOCK:
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(asyncio.run, _runner())
            return future.result()

# --- SCRAPER HÍBRIDO ---
def _fetch_with_requests(url: str) -> Dict[str, Any]:
    """
    Ayudante interno para obtener una URL usando `requests`. Ruta rápida.

    Args:
        url (str): URL a obtener.

    Returns:
        dict: Resultado con 'content', 'status', 'method', 'error'.
    """
    try:
        response = requests.get(url, headers=get_optimized_headers(), timeout=10)
        if response.status_code == 200 and len(response.content) > 500:
             return {'url': url, 'content': response.content, 'status': response.status_code, 'method': 'Requests', 'error': None}
        return {'url': url, 'content': None, 'status': response.status_code, 'method': 'Requests', 'error': None}
    except Exception as e:
        logging.error(f"Scraper Request Error for {url}: {e}")
        return {'url': url, 'content': None, 'status': 0, 'method': 'Requests', 'error': 'Error de conexión'}

def _fetch_with_playwright(url: str) -> Dict[str, Any]:
    """
    Ayudante interno para obtener una URL usando `playwright`. Ruta lenta para sitios con mucho JS.

    Args:
        url (str): URL a obtener.

    Returns:
        dict: Resultado con 'content', 'status', 'method', 'error'.
    """
    result: Dict[str, Any] = {'url': url, 'content': None, 'status': 0, 'method': 'Playwright (JS)', 'error': None}
    try:
        result['content'] = _run_async_playwright(url)
        result['status'] = 200
    except Exception as e:
        logging.error(f"Scraper Playwright Error for {url}: {e}")
        result['error'] = 'Error de navegación'
    return result

def fetch_url_hybrid(url: str, delay: Union[int, float] = 0) -> Dict[str, Any]:
    """
    Intenta obtener el contenido de una URL utilizando `requests` (rápido) y, si falla o el contenido es insuficiente,
    recurre a `playwright` (lento, soporta JS).

    Args:
        url (str): La URL a obtener.
        delay (int/float): Tiempo de espera antes de la petición Requests.

    Returns:
        dict: Diccionario con 'url', 'content', 'status', 'method' y 'error'.
    """
    if not is_safe_url(url):
        return {'url': url, 'content': None, 'status': 0, 'method': 'Blocked', 'error': 'URL no permitida'}

    if delay > 0:
        time.sleep(delay)

    # Try requests first
    result = _fetch_with_requests(url)
    if result['content']:
        return result

    # Fallback to Playwright if requests failed to get content (or got small content/non-200)
    # So if that failed, we try playwright.

    return _fetch_with_playwright(url)

def get_soup(url: str, delay: int = 0) -> Optional[BeautifulSoup]:
    result = fetch_url_hybrid(url, delay)
    return BeautifulSoup(result['content'], 'html.parser') if result['content'] else None

# --- NEW ROBUST URL FETCHING ---
def fetch_url(url: str, connect_timeout: int = 10, read_timeout: int = 30, random_delay: bool = True) -> Dict[str, Any]:
    """
    Robust HTTP fetching wrapper using the global robust session.

    Args:
        url (str): The URL to fetch.
        connect_timeout (int): Connect timeout in seconds.
        read_timeout (int): Read timeout in seconds.
        random_delay (bool): If True, wait 1-3 seconds before fetching.

    Returns:
        dict: A structured dictionary with status and extracted information.
    """
    if random_delay:
        time.sleep(random.uniform(1, 3))

    start_time = time.time()

    result = {
        'url': url,
        'ok': False,
        'status_code': None,
        'final_url': None,
        'html': None,
        'error_type': None,
        'error_message': None,
        'elapsed_ms': 0
    }

    try:
        response = robust_session.get(
            url,
            headers=get_optimized_headers(),
            timeout=(connect_timeout, read_timeout)
        )

        # Calculate elapsed time
        result['elapsed_ms'] = int((time.time() - start_time) * 1000)
        result['status_code'] = response.status_code
        result['final_url'] = response.url

        if response.status_code == 200:
            result['ok'] = True
            result['html'] = response.text
            logging.info(f"fetch_url OK: {url} | Status: {response.status_code} | Time: {result['elapsed_ms']}ms")
        elif response.status_code == 403:
            result['error_type'] = 'blocked_403'
            result['error_message'] = f"HTTP {response.status_code}"
            logging.warning(f"fetch_url BLOCKED: {url} | Status: {response.status_code} | Time: {result['elapsed_ms']}ms")
        elif response.status_code == 429:
            result['error_type'] = 'rate_limited_429'
            result['error_message'] = f"HTTP {response.status_code}"
            logging.warning(f"fetch_url RATE_LIMITED: {url} | Status: {response.status_code} | Time: {result['elapsed_ms']}ms")
        else:
            result['error_type'] = 'other'
            result['error_message'] = f"HTTP {response.status_code}"
            logging.warning(f"fetch_url OTHER HTTP ERROR: {url} | Status: {response.status_code} | Time: {result['elapsed_ms']}ms")

    except requests.exceptions.ConnectTimeout as e:
        result['elapsed_ms'] = int((time.time() - start_time) * 1000)
        result['error_type'] = 'connect_timeout'
        result['error_message'] = str(e)
        logging.error(f"fetch_url CONNECT TIMEOUT: {url} | Time: {result['elapsed_ms']}ms | Error: {e}")
    except requests.exceptions.ReadTimeout as e:
        result['elapsed_ms'] = int((time.time() - start_time) * 1000)
        result['error_type'] = 'read_timeout'
        result['error_message'] = str(e)
        logging.error(f"fetch_url READ TIMEOUT: {url} | Time: {result['elapsed_ms']}ms | Error: {e}")
    except requests.exceptions.SSLError as e:
        result['elapsed_ms'] = int((time.time() - start_time) * 1000)
        result['error_type'] = 'ssl_error'
        result['error_message'] = str(e)
        logging.error(f"fetch_url SSL ERROR: {url} | Time: {result['elapsed_ms']}ms | Error: {e}")
    except requests.exceptions.ConnectionError as e:
        result['elapsed_ms'] = int((time.time() - start_time) * 1000)
        error_str = str(e).lower()
        if 'name resolution' in error_str or 'nodename nor servname' in error_str:
            result['error_type'] = 'dns_error'
        else:
            result['error_type'] = 'connection_error'
        result['error_message'] = str(e)
        logging.error(f"fetch_url CONNECTION ERROR ({result['error_type']}): {url} | Time: {result['elapsed_ms']}ms | Error: {e}")
    except requests.exceptions.RequestException as e:
        result['elapsed_ms'] = int((time.time() - start_time) * 1000)
        result['error_type'] = 'other'
        result['error_message'] = str(e)
        logging.error(f"fetch_url REQUEST ERROR: {url} | Time: {result['elapsed_ms']}ms | Error: {e}")
    except Exception as e:
        result['elapsed_ms'] = int((time.time() - start_time) * 1000)
        result['error_type'] = 'other'
        result['error_message'] = str(e)
        logging.error(f"fetch_url OTHER ERROR: {url} | Time: {result['elapsed_ms']}ms | Error: {e}")

    return result

def fetch_many(urls: List[str], max_workers: int = 5, connect_timeout: int = 10, read_timeout: int = 30, random_delay: bool = True) -> List[Dict[str, Any]]:
    """
    Robust HTTP fetching wrapper to process multiple URLs concurrently.

    Args:
        urls (List[str]): List of URLs to fetch.
        max_workers (int): Maximum number of concurrent workers.
        connect_timeout (int): Connect timeout in seconds.
        read_timeout (int): Read timeout in seconds.
        random_delay (bool): If True, wait 1-3 seconds before fetching each URL.

    Returns:
        List[Dict[str, Any]]: A list of dictionaries with status and extracted information, in the same order as the input URLs.
    """
    results_map: Dict[str, Dict[str, Any]] = {}

    def fetch_task(url: str) -> None:
        try:
            results_map[url] = fetch_url(
                url,
                connect_timeout=connect_timeout,
                read_timeout=read_timeout,
                random_delay=random_delay
            )
        except Exception as e:
            # Fallback for unexpected task runner errors
            results_map[url] = {
                'url': url,
                'ok': False,
                'status_code': None,
                'final_url': None,
                'html': None,
                'error_type': 'task_error',
                'error_message': str(e),
                'elapsed_ms': 0
            }
            logging.error(f"fetch_many TASK ERROR for {url}: {e}")

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        executor.map(fetch_task, urls)

    # Return results in the exact same order as the input URLs
    return [results_map[url] for url in urls]

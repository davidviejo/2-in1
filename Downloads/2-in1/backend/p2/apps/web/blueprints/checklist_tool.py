"""
Módulo Checklist Tool (LEGACY).

Legacy del checklist basado en plantillas Flask.
La experiencia canónica de checklist ahora vive en la SPA.

Este módulo mantiene únicamente:
- La lógica de motor reutilizable `check_url_compliance`.
- Un endpoint puente `/checklist` que redirige a la SPA.

No expone endpoints legacy de ejecución/descarga para evitar duplicación funcional.

Realiza una auditoría básica de SEO On-Page para una URL.
Verifica imágenes, estructura de encabezados (H1-H3), enlaces internos, snippet y presencia de Schema.
"""

import os
from urllib.parse import urljoin, urlparse

from flask import Blueprint, redirect, render_template, request
import requests
from bs4 import BeautifulSoup
import re
import json
from apps.tools.utils import is_safe_url

checklist_bp = Blueprint('checklist', __name__, url_prefix='/checklist')

GOOGLE_MAPS_PATTERN = re.compile(r'(google\.[^/]+/maps|maps\.google)', re.IGNORECASE)
FAQ_SCHEMA_TYPES = {'FAQPage', 'Question', 'Answer'}


def resolve_checklist_spa_url() -> str:
    """
    Resuelve la URL canónica de Checklist SPA.

    Prioridad:
    1. `MEDIAFLOW_FRONTEND_URL` cuando frontend/backend viven en hosts distintos.
    2. HashRouter en la misma origin (`/#/app/checklist`).
    """
    configured_base = (os.getenv('MEDIAFLOW_FRONTEND_URL') or '').strip().rstrip('/')
    hash_route = '/#/app/checklist'

    if configured_base:
        return urljoin(f'{configured_base}/', hash_route.lstrip('/'))

    return hash_route


def _normalize_text(value):
    return value.strip() if isinstance(value, str) else ''


def _get_meta_content(soup, *names):
    lowered = {name.lower() for name in names}
    for meta in soup.find_all('meta'):
        meta_name = (meta.get('name') or meta.get('property') or '').lower()
        if meta_name in lowered:
            return _normalize_text(meta.get('content', ''))
    return ''


def _extract_json_ld_payloads(soup):
    payloads = []
    for script in soup.find_all('script', type='application/ld+json'):
        raw = script.get_text(strip=True)
        if not raw:
            continue
        try:
            payloads.append(json.loads(raw))
        except json.JSONDecodeError:
            continue
    return payloads


def _contains_faq_schema(payload):
    if isinstance(payload, dict):
        schema_type = payload.get('@type')
        types = schema_type if isinstance(schema_type, list) else [schema_type]
        if any(t in FAQ_SCHEMA_TYPES for t in types if isinstance(t, str)):
            return True
        return any(_contains_faq_schema(value) for value in payload.values())
    if isinstance(payload, list):
        return any(_contains_faq_schema(item) for item in payload)
    return False


def _is_internal_link(base_netloc, candidate_href):
    parsed = urlparse(candidate_href)
    return not parsed.netloc or parsed.netloc == base_netloc


def check_url_compliance(url):
    """
    Analiza una URL individual para extraer métricas de conformidad SEO.

    Verificaciones:
    - Imágenes: Conteo total y cuántas faltan de texto ALT.
    - Estructura: Existencia de H1 único y lista de H1-H3.
    - Enlaces: Conteo de enlaces internos.
    - Snippet: Presencia de Title y Meta Description.
    - Otros: Geolocalización (iframe maps) y Datos Estructurados (JSON-LD).

    Args:
        url (str): La URL a analizar.

    Returns:
        dict: Diccionario con 'summary', 'images', 'headers', 'links', 'snippet'.
    """
    data = {'summary': {}, 'images': [], 'headers': [], 'links': [], 'snippet': {}}
    checklist_row = {
        'URL': url,
        'Geolocalización': 'NO',
        'Datos Estructurados': 'NO',
        'Preguntas frecuentes': 'NO',
        'Contenido': '0',
        'Snippet': 'Falta',
        'Imagenes': '0',
        'Enlazado Interno': '0',
        'Estructura': 'Mal'
    }

    if not is_safe_url(url):
        data['summary'] = checklist_row
        return data

    try:
        resp = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=10)
        if resp.status_code != 200:
            data['summary'] = checklist_row
            return data

        soup = BeautifulSoup(resp.content, 'html.parser')
        base_netloc = urlparse(url).netloc

        imgs = soup.find_all('img')
        missing_alt = sum(1 for img in imgs if not _normalize_text(img.get('alt')))
        checklist_row['Imagenes'] = f"{len(imgs)} ({missing_alt} sin alt)"
        for img in imgs:
            data['images'].append({
                'Origen': url,
                'Src': urljoin(url, img.get('src', '')) if img.get('src') else '',
                'Alt': _normalize_text(img.get('alt')) or 'MISSING'
            })

        headers = soup.find_all(['h1', 'h2', 'h3'])
        h1s = [h for h in headers if h.name == 'h1']
        checklist_row['Estructura'] = 'Correcta' if len(h1s) == 1 else 'Mal'
        for header in headers:
            data['headers'].append({'Tag': header.name, 'Txt': header.get_text(strip=True)})

        links = soup.find_all('a', href=True)
        internal_links = []
        for link in links:
            absolute_href = urljoin(url, link['href'])
            if _is_internal_link(base_netloc, absolute_href):
                internal_links.append(link)
                data['links'].append({
                    'Href': absolute_href,
                    'Anchor': link.get_text(strip=True)
                })
        checklist_row['Enlazado Interno'] = str(len(internal_links))

        title = _normalize_text(soup.title.string if soup.title and soup.title.string else '')
        description = _get_meta_content(soup, 'description', 'og:description')
        if title and description:
            checklist_row['Snippet'] = 'Completo'
        elif title or description:
            checklist_row['Snippet'] = 'Parcial'
        data['snippet'] = {'Title': title, 'Desc': description}

        json_ld_payloads = _extract_json_ld_payloads(soup)

        text_soup = BeautifulSoup(resp.content, 'html.parser')
        for noisy_tag in text_soup(['script', 'style', 'noscript']):
            noisy_tag.extract()
        text_root = text_soup.body or text_soup
        text_content = text_root.get_text(' ', strip=True)
        checklist_row['Contenido'] = str(len(text_content.split())) if text_content else '0'

        if json_ld_payloads:
            checklist_row['Datos Estructurados'] = 'SI'
        if any(_contains_faq_schema(payload) for payload in json_ld_payloads):
            checklist_row['Preguntas frecuentes'] = 'SI'

        if any(GOOGLE_MAPS_PATTERN.search(iframe.get('src', '')) for iframe in soup.find_all('iframe')):
            checklist_row['Geolocalización'] = 'SI'

    except requests.RequestException:
        pass

    data['summary'] = checklist_row
    return data


@checklist_bp.route('/', strict_slashes=False)
def index():
    """
    Pantalla legacy del checklist con enlace explícito al SPA canónico.

    Soporta `?redirect=1` para mantener comportamiento de puente cuando
    se necesite navegación automática.
    """
    should_redirect = request.args.get('redirect', '').lower() in {'1', 'true', 'yes'}
    spa_url = resolve_checklist_spa_url()
    if should_redirect:
        return redirect(spa_url, code=302)

    return render_template('checklist/dashboard.html', spa_url=spa_url)


@checklist_bp.route('/spa')
def redirect_to_spa():
    """Endpoint puente explícito para redirigir al checklist SPA canónico."""
    return redirect(resolve_checklist_spa_url(), code=302)

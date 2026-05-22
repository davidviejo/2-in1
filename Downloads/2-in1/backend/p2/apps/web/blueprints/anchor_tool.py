"""
Módulo para el análisis de textos de anclaje (anchor texts).
Permite escanear URLs para extraer y analizar los textos de los enlaces que apuntan al mismo dominio.
"""
from flask import Blueprint, render_template, request, jsonify, send_file
import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse, urljoin
import concurrent.futures
import pandas as pd
import io
from collections import Counter

anchor_bp = Blueprint('anchor', __name__, url_prefix='/anchor')


def _resolve_link_location(anchor_tag):
    for parent in anchor_tag.parents:
        tag_name = (getattr(parent, 'name', '') or '').lower()
        if tag_name == 'header':
            return 'header'
        if tag_name == 'footer':
            return 'footer'
        if tag_name in {'main', 'article', 'section'}:
            return 'content'

        classes = ' '.join(parent.get('class', [])).lower() if hasattr(parent, 'get') else ''
        identifier = (parent.get('id', '') or '').lower() if hasattr(parent, 'get') else ''
        hint = f"{classes} {identifier}"
        if any(token in hint for token in ['header', 'menu', 'nav', 'masthead']):
            return 'header'
        if any(token in hint for token in ['footer', 'legal', 'copyright']):
            return 'footer'

    return 'content'


def scan(url, dom):
    """
    Escanea una URL en busca de enlaces internos que coincidan con el dominio dado.

    Args:
        url (str): La URL a escanear.
        dom (str): El dominio base para filtrar enlaces internos.

    Returns:
        list: Lista de diccionarios con URL origen, destino, anchor y ubicación.
    """
    links = []
    try:
        response = requests.get(url, timeout=10, headers={'User-Agent': 'Mozilla/5.0'})
        soup = BeautifulSoup(response.content, 'html.parser')
        for anchor in soup.find_all('a', href=True):
            full = urljoin(url, anchor['href'])
            text = anchor.get_text(' ', strip=True)
            if not text or dom not in urlparse(full).netloc:
                continue
            links.append({
                'source_url': url,
                'target_url': full.split('#')[0],
                'anchor': text,
                'location': _resolve_link_location(anchor),
            })
    except Exception:
        pass
    return links


@anchor_bp.route('/')
def index():
    return render_template('anchor/dashboard.html')


@anchor_bp.route('/analyze', methods=['POST'])
def analyze():
    """Endpoint para analizar múltiples URLs y extraer detalle + agregados de anchor texts."""
    urls = request.json.get('urls', [])
    dom = urlparse(urls[0]).netloc if urls else ''
    all_links = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
        futures = {ex.submit(scan, url, dom): url for url in urls if url.strip()}
        for future in concurrent.futures.as_completed(futures):
            all_links.extend(future.result())

    by_target = {}
    for link in all_links:
        target = link['target_url']
        if target not in by_target:
            by_target[target] = []
        by_target[target].append(link['anchor'])

    summary = []
    for target, anchors in by_target.items():
        common = Counter(anchors).most_common(5)
        summary.append({
            'url': target,
            'total': len(anchors),
            'top': ", ".join([f"{text}({count})" for text, count in common]),
        })

    return jsonify({
        'status': 'ok',
        'summary': sorted(summary, key=lambda item: item['total'], reverse=True)[:100],
        'details': all_links,
    })


@anchor_bp.route('/download', methods=['POST'])
def download():
    """Genera y descarga un archivo Excel con los datos del análisis."""
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        pd.DataFrame(request.json.get('data')).to_excel(writer, index=False)
    output.seek(0)
    return send_file(output, download_name='anchors.xlsx', as_attachment=True)

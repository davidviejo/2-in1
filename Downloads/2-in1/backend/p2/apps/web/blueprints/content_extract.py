"""
Módulo para extracción y limpieza de contenido web.
Convierte contenido HTML a Markdown simplificado, eliminando elementos no deseados.
"""
from flask import Blueprint, render_template, request, jsonify
import requests
import logging
from bs4 import BeautifulSoup
import concurrent.futures
import re
from typing import Dict, Any
from apps.tools.utils import is_safe_url

extract_bp = Blueprint('extract', __name__, url_prefix='/extract')

WS_PATTERN = re.compile(r'\s+')

def clean(url: str) -> Dict[str, Any]:
    """
    Descarga y limpia el contenido de una URL, convirtiéndolo a Markdown.

    Args:
        url (str): La URL a procesar.

    Returns:
        dict: Diccionario con el markdown generado, conteo de palabras y errores si los hubo.
    """
    result = {'url': url, 'markdown': '', 'word_count': 0, 'error': None}
    if not is_safe_url(url):
        result['error'] = 'URL no permitida'
        return result
    try:
        response = requests.get(url, headers={'User-Agent':'Mozilla/5.0'}, timeout=8)
        soup = BeautifulSoup(response.content, 'html.parser')
        for x in soup(["script","style","nav","footer"]): x.extract()
        markdown_lines = []
        for tag in soup.find_all(['h1','h2','h3','p']):
            txt = WS_PATTERN.sub(' ', tag.get_text(strip=True))
            if len(txt)>10:
                pre = '#' if tag.name=='h1' else ('##' if tag.name=='h2' else '')
                markdown_lines.append(f"{pre} {txt}")
        result['markdown'] = "\n".join(markdown_lines)
        result['word_count'] = len(result['markdown'].split())
    except Exception as e:
        logging.error(f"Extract error {url}: {e}")
        result['error'] = 'Error procesando el contenido'
    return result

@extract_bp.route('/')
def index(): return render_template('content_extract/dashboard.html')

@extract_bp.route('/run', methods=['POST'])
def run():
    """
    Endpoint para extracción masiva de contenido.

    Procesa una lista de URLs y devuelve el contenido limpio individual y combinado.

    Returns:
        JSON: Resultados individuales y texto combinado de todas las URLs exitosas.
    """
    urls = request.json.get('urls', [])
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        future_to_url = {executor.submit(clean, url): url for url in urls if url.strip()}
        for future in concurrent.futures.as_completed(future_to_url): results.append(future.result())
    combined_text = "\n\n".join([r['markdown'] for r in results if not r['error']])
    return jsonify({'status':'ok', 'data':results, 'combined':combined_text})

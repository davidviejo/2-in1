"""
Módulo para análisis de Snippets.

Este módulo permite analizar si el contenido de una URL está optimizado para
aparecer en los fragmentos destacados (Featured Snippets) de Google, evaluando
la estructura, longitud y colocación de la palabra clave.
"""
from typing import Dict, Any
import logging
import requests
from flask import Blueprint, render_template, request, jsonify
from bs4 import BeautifulSoup
from apps.tools.utils import is_safe_url

snippet_bp = Blueprint('snippet', __name__, url_prefix='/snippet')

def analyze_snippet(url: str, kw: str) -> Dict[str, Any]:
    """
    Analiza una URL para verificar oportunidades de Featured Snippet.

    Args:
        url (str): La URL a analizar.
        kw (str): La palabra clave objetivo.

    Returns:
        Dict[str, Any]: Diccionario con los resultados del análisis, incluyendo
                        score, mensajes y texto encontrado.
    """
    result: Dict[str, Any] = {
        'url': url,
        'found': False,
        'text': '',
        'score': 0,
        'msg': []
    }

    if not is_safe_url(url):
        result['msg'].append('URL no permitida')
        result['error'] = 'URL no permitida'
        return result

    try:
        response = requests.get(
            url,
            headers={'User-Agent': 'Mozilla/5.0'},
            timeout=8
        )
        soup = BeautifulSoup(response.content, 'html.parser')

        target_header = None
        # Buscar la keyword en encabezados H2 o H3
        for header in soup.find_all(['h2', 'h3']):
            if kw and kw.lower() in header.get_text().lower():
                target_header = header
                result['found'] = True
                break

        if target_header:
            paragraph = target_header.find_next_sibling('p')
            if paragraph:
                text = paragraph.get_text(strip=True)
                result['text'] = text
                word_count = len(text.split())

                # Evaluar longitud ideal (40-60 palabras)
                if 40 <= word_count <= 60:
                    result['score'] += 50
                    result['msg'].append("Longitud OK")
                else:
                    result['msg'].append(f"Longitud {word_count} (Ideal 40-60)")

                # Evaluar si la definición empieza con la keyword (o cerca)
                if kw and kw.lower() in text.lower()[:20]:
                    result['score'] += 50
                    result['msg'].append("Empieza definiendo")

    except Exception as e:
        logging.error(f"Snippet error {url}: {e}")
        result['msg'].append("Error procesando URL")

    return result

@snippet_bp.route('/')
def index():
    """Renderiza la vista principal del dashboard de snippets."""
    return render_template('snippet/dashboard.html')

@snippet_bp.route('/check', methods=['POST'])
def check():
    """Endpoint API para analizar una URL."""
    data = request.get_json(silent=True) or {}
    url = data.get('url')
    keyword = data.get('keyword')

    if not url or not keyword:
        return jsonify({'status': 'error', 'message': 'Faltan datos'}), 400

    if len(url) > 2000:
        return jsonify({'status': 'error', 'message': 'URL demasiado larga (máx 2000 caracteres)'}), 400
    if len(keyword) > 200:
        return jsonify({'status': 'error', 'message': 'Keyword demasiado larga (máx 200 caracteres)'}), 400

    return jsonify({'status': 'ok', 'data': analyze_snippet(url, keyword)})

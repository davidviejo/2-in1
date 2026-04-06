"""
Módulo para calcular la proporción Texto/HTML (Text-to-HTML Ratio).
Útil para detectar páginas con "Thin Content" o exceso de código.
"""
from typing import List, Dict, Any
from flask import Blueprint, render_template, request, jsonify, Response
import requests
from bs4 import BeautifulSoup

ratio_bp = Blueprint('ratio', __name__, url_prefix='/ratio')

@ratio_bp.route('/')
def index() -> str:
    return render_template('ratio/dashboard.html')

@ratio_bp.route('/analyze', methods=['POST'])
def analyze() -> Response:
    """
    Analiza una lista de URLs para calcular su ratio Texto/HTML.

    Request JSON:
        urls (list): Lista de URLs a analizar.

    Returns:
        JSON: Lista con resultados (ratio, tamaño HTML, tamaño texto) para cada URL.
    """
    urls: List[str] = (request.get_json(silent=True) or {}).get('urls') or []
    results: List[Dict[str, Any]] = []

    for url in urls:
        if not url.strip():
            continue
        try:
            response = requests.get(url, timeout=5)
            html_size = len(response.content)

            if html_size == 0:
                continue

            soup = BeautifulSoup(response.content, 'html.parser')

            for element in soup(["script", "style"]):
                element.extract()

            text_size = len(soup.get_text(separator=' ', strip=True).encode('utf-8'))

            results.append({
                'url': url,
                'ratio': round((text_size / html_size) * 100, 2),
                'html': html_size,
                'text': text_size
            })
        except Exception:
            pass

    return jsonify({'status': 'ok', 'data': results})

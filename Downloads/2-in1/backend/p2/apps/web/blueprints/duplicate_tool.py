"""
Módulo para detectar contenido duplicado entre dos URLs.
Utiliza la similitud de texto (SequenceMatcher) para calcular un porcentaje de coincidencia.
"""
from flask import Blueprint, render_template, request, jsonify
import requests
from bs4 import BeautifulSoup
from difflib import SequenceMatcher
from apps.tools.utils import is_safe_url

duplicate_bp = Blueprint('duplicate', __name__, url_prefix='/duplicate')

def get_text(url):
    """
    Descarga y extrae el texto plano de una URL.

    Args:
        url (str): La URL a procesar.

    Returns:
        str: El texto extraído o cadena vacía si hay error.
    """
    if not is_safe_url(url):
        return ""
    try: return BeautifulSoup(requests.get(url, timeout=5).content, 'html.parser').get_text(" ", strip=True)
    except: return ""

@duplicate_bp.route('/')
def index(): return render_template('duplicate/dashboard.html')

@duplicate_bp.route('/compare', methods=['POST'])
def compare():
    """
    Compara el contenido de texto de dos URLs y devuelve el porcentaje de similitud.

    Returns:
        JSON: Diccionario con el estado y el ratio de similitud (0-100).
    """
    t1 = get_text(request.json.get('url1'))
    t2 = get_text(request.json.get('url2'))
    ratio = round(SequenceMatcher(None, t1, t2).ratio() * 100, 1)
    return jsonify({'status': 'ok', 'ratio': ratio})

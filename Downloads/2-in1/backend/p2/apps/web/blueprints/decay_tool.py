"""
Módulo para análisis de "Content Decay" (decadencia de contenido).
Verifica la fecha de publicación de URLs para identificar contenido obsoleto.
"""
from flask import Blueprint, render_template, request, jsonify
import requests
from bs4 import BeautifulSoup
import concurrent.futures
from datetime import datetime

decay_bp = Blueprint('decay', __name__, url_prefix='/decay')

def check_freshness(url):
    """
    Obtiene la antigüedad de una URL basándose en metadatos (article:published_time).

    Args:
        url (str): URL a comprobar.

    Returns:
        dict: Resultado con URL y días de antigüedad (-1 si no se encuentra fecha).
    """
    d = {'url': url, 'days': -1}
    try:
        r = requests.get(url, timeout=5)
        s = BeautifulSoup(r.content, 'html.parser')
        date = None
        # Buscamos meta published
        m = s.find('meta', property='article:published_time')
        if m: date = m['content'][:10]

        if date:
            dt = datetime.strptime(date, '%Y-%m-%d')
            d['days'] = (datetime.now() - dt).days
    except: pass
    return d

@decay_bp.route('/')
def index(): return render_template('decay/dashboard.html')

@decay_bp.route('/analyze', methods=['POST'])
def analyze():
    """
    Endpoint para analizar la frescura de una lista de URLs.
    Ejecuta comprobaciones en paralelo.

    Returns:
        JSON: Lista de resultados ordenada por antigüedad (los más antiguos primero).
    """
    urls = (request.get_json(silent=True) or {}).get('urls', [])
    res = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
        ft = {ex.submit(check_freshness, u): u for u in urls if u.strip()}
        for f in concurrent.futures.as_completed(ft): res.append(f.result())
    res.sort(key=lambda x: x['days'], reverse=True)
    return jsonify({'status': 'ok', 'data': res})

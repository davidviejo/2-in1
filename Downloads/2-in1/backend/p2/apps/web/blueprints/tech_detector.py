"""
Módulo para detección de tecnologías web.
Identifica CMS (WordPress, Shopify, etc.), plugins de SEO y herramientas de analítica.
"""
from flask import Blueprint, render_template, request, jsonify
import requests
import concurrent.futures

tech_bp = Blueprint('tech', __name__, url_prefix='/tech')

def detect(url):
    """
    Analiza una URL para detectar tecnologías subyacentes.

    Args:
        url (str): La URL a analizar.

    Returns:
        dict: Diccionario con CMS, plugin SEO, herramientas de analítica y servidor detectados.
    """
    d = {'url': url, 'cms': 'Unknown', 'seo': 'None', 'analytics': [], 'server': ''}
    try:
        r = requests.get(url, headers={'User-Agent':'Mozilla/5.0'}, timeout=8)
        d['server'] = r.headers.get('Server', '')
        h = r.text.lower()
        if '/wp-content/' in h: d['cms'] = 'WordPress'
        elif 'shopify' in h: d['cms'] = 'Shopify'
        elif 'wix' in h: d['cms'] = 'Wix'

        if 'yoast' in h: d['seo'] = 'Yoast'
        elif 'rank math' in h: d['seo'] = 'RankMath'

        if 'gtm-' in h: d['analytics'].append('GTM')
        if 'ua-' in h or 'g-' in h: d['analytics'].append('GA')
        if 'fbevents' in h: d['analytics'].append('Pixel')
    except: pass
    return d

@tech_bp.route('/')
def index(): return render_template('tech_detector/dashboard.html')

@tech_bp.route('/analyze', methods=['POST'])
def analyze():
    """
    Endpoint para análisis masivo de tecnologías en una lista de URLs.

    Utiliza un pool de hilos para procesar múltiples peticiones simultáneamente.

    Returns:
        JSON: Lista de resultados de detección para cada URL.
    """
    urls = request.json.get('urls', [])
    res = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
        ft = {ex.submit(detect, u): u for u in urls if u.strip()}
        for f in concurrent.futures.as_completed(ft): res.append(f.result())
    return jsonify({'status': 'ok', 'data': res})

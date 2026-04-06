"""
Módulo para el rastreo (crawling) basado en profundidad.
Permite explorar un sitio web hasta un nivel de profundidad específico.
"""
from flask import Blueprint, render_template, request, jsonify, send_file
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
import pandas as pd
import io

depth_bp = Blueprint('depth', __name__, url_prefix='/depth')

def crawl(start, max_d, limit):
    """
    Realiza un rastreo BFS (Breadth-First Search) desde una URL inicial.

    Args:
        start (str): URL de inicio.
        max_d (int): Profundidad máxima de rastreo.
        limit (int): Límite total de URLs a rastrear.

    Returns:
        list: Lista de diccionarios con 'url' y 'depth'.
    """
    visited = {}
    queue = [(start, 0)]
    domain = urlparse(start).netloc
    res = []

    while queue and len(res) < limit:
        url, depth = queue.pop(0)
        if url in visited and visited[url] <= depth: continue
        visited[url] = depth
        res.append({'url': url, 'depth': depth})

        if depth >= max_d: continue
        try:
            r = requests.get(url, timeout=3)
            s = BeautifulSoup(r.content, 'html.parser')
            for a in s.find_all('a', href=True):
                full = urljoin(url, a['href']).split('#')[0].rstrip('/')
                if urlparse(full).netloc == domain and full not in visited:
                    queue.append((full, depth+1))
        except: pass
    return res

@depth_bp.route('/')
def index(): return render_template('depth/dashboard.html')

@depth_bp.route('/run', methods=['POST'])
def run():
    """
    Ejecuta el rastreador de profundidad y devuelve estadísticas.

    Returns:
        JSON: Datos del rastreo y conteos por nivel de profundidad.
    """
    req = request.get_json(silent=True) or {}
    url = req.get('url')
    if not url:
        return jsonify({'error': 'URL missing'}), 400

    d = crawl(url, int(req.get('max_depth', 2)), int(req.get('limit', 50)))
    stats = {'d0':len([x for x in d if x['depth']==0]), 'd1':len([x for x in d if x['depth']==1]), 'd2':len([x for x in d if x['depth']==2]), 'd3':len([x for x in d if x['depth']>=3])}
    return jsonify({'status':'ok', 'data':d, 'stats':stats})

@depth_bp.route('/download', methods=['POST'])
def download():
    """
    Genera y descarga un archivo Excel con los resultados del rastreo.

    Returns:
        Response: Archivo Excel adjunto.
    """
    o = io.BytesIO()
    with pd.ExcelWriter(o, engine='openpyxl') as w: pd.DataFrame((request.get_json(silent=True) or {}).get('data', [])).to_excel(w, index=False)
    o.seek(0)
    return send_file(o, download_name='depth.xlsx', as_attachment=True)

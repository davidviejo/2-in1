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

def scan(url, dom):
    """
    Escanea una URL en busca de enlaces internos que coincidan con el dominio dado.

    Args:
        url (str): La URL a escanear.
        dom (str): El dominio base para filtrar enlaces internos.

    Returns:
        list: Lista de diccionarios con 'target' (URL destino) y 'text' (texto ancla).
    """
    l = []
    try:
        r = requests.get(url, timeout=5)
        s = BeautifulSoup(r.content, 'html.parser')
        for a in s.find_all('a', href=True):
            full = urljoin(url, a['href'])
            txt = a.get_text(strip=True)
            if txt and dom in urlparse(full).netloc: l.append({'target': full, 'text': txt})
    except: pass
    return l

@anchor_bp.route('/')
def index(): return render_template('anchor/dashboard.html')

@anchor_bp.route('/analyze', methods=['POST'])
def analyze():
    """
    Endpoint para analizar múltiples URLs y extraer estadísticas de anchor texts.

    Returns:
        JSON: Datos procesados con los anchor texts más comunes por URL destino.
    """
    urls = request.json.get('urls', [])
    dom = urlparse(urls[0]).netloc if urls else ''
    all_links = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
        ft = {ex.submit(scan, u, dom): u for u in urls if u.strip()}
        for f in concurrent.futures.as_completed(ft): all_links.extend(f.result())

    targ = {}
    for l in all_links:
        t = l['target'].split('#')[0]
        if t not in targ: targ[t] = []
        targ[t].append(l['text'])

    res = []
    for u, anchors in targ.items():
        c = Counter(anchors).most_common(5)
        res.append({'url': u, 'total': len(anchors), 'top': ", ".join([f"{k}({v})" for k,v in c])})

    return jsonify({'status': 'ok', 'data': sorted(res, key=lambda x: x['total'], reverse=True)[:100]})

@anchor_bp.route('/download', methods=['POST'])
def download():
    """
    Genera y descarga un archivo Excel con los datos del análisis.

    Returns:
        Response: Archivo Excel adjunto.
    """
    o = io.BytesIO()
    with pd.ExcelWriter(o, engine='openpyxl') as w: pd.DataFrame(request.json.get('data')).to_excel(w, index=False)
    o.seek(0)
    return send_file(o, download_name='anchors.xlsx', as_attachment=True)

from typing import List, Dict, Any
from flask import Blueprint, render_template, request, jsonify, send_file, Response
import requests
from bs4 import BeautifulSoup
import concurrent.futures
from urllib.parse import urljoin
import pandas as pd
import io
from apps.tools.utils import validate_url, is_safe_url

image_bp = Blueprint('image_audit', __name__, url_prefix='/image_audit')

def scan_imgs(url: str) -> Dict[str, Any]:
    """
    Escanea una URL en busca de imágenes, obteniendo su tamaño y atributo alt.

    Args:
        url (str): La URL a escanear.

    Returns:
        dict: Diccionario con la URL escaneada y una lista de imágenes encontradas
              (src, size, alt).
    """
    d: Dict[str, Any] = {'url': url, 'images': []}

    if not is_safe_url(url):
        return d

    try:
        r = requests.get(url, timeout=5)
        s = BeautifulSoup(r.content, 'html.parser')
        for i in s.find_all('img'):
            if not i.get('src'):
                continue
            src = urljoin(url, i.get('src'))

            # Validar también la imagen para evitar SSRF indirecto
            if not is_safe_url(src):
                continue

            try:
                h = requests.head(src, timeout=2)
                sz = int(h.headers.get('content-length', 0))/1024
                d['images'].append({'src': src, 'size': round(sz, 1), 'alt': i.get('alt', '')})
            except Exception:
                pass
    except Exception:
        pass
    return d

@image_bp.route('/')
def index() -> str:
    return render_template('image_audit/dashboard.html')

@image_bp.route('/scan', methods=['POST'])
def scan() -> Any:
    """
    Endpoint para escanear múltiples URLs en paralelo.
    Espera un JSON con una lista de URLs en la clave 'urls'.
    """
    data = request.get_json(silent=True) or {}
    urls = data.get('urls', [])
    if not isinstance(urls, list):
        return jsonify({'error': 'Formato inválido'}), 400

    # Usar is_safe_url para filtrar URLs peligrosas desde el principio
    valid_urls = [u for u in urls if isinstance(u, str) and is_safe_url(u)]

    res: List[Dict[str, Any]] = []
    # Ejecución paralela para acelerar el escaneo de múltiples URLs
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex:
        ft = {ex.submit(scan_imgs, u): u for u in valid_urls}
        for f in concurrent.futures.as_completed(ft):
            res.append(f.result())
    return jsonify({'status': 'ok', 'data': res})

@image_bp.route('/download', methods=['POST'])
def download() -> Any:
    """
    Genera y descarga un archivo Excel con el reporte de imágenes.
    Espera los datos del reporte en el cuerpo de la petición.
    """
    data = (request.get_json(silent=True) or {}).get('data', [])
    rows = []
    for p in data:
        for i in p.get('images', []):
            rows.append({'Page': p.get('url', ''), 'Img': i.get('src', ''), 'Size KB': i.get('size', 0), 'Alt': i.get('alt', '')})
    o = io.BytesIO()
    with pd.ExcelWriter(o, engine='openpyxl') as w:
        pd.DataFrame(rows).to_excel(w, index=False)
    o.seek(0)
    return send_file(o, download_name='images.xlsx', as_attachment=True)

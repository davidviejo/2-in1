"""
Módulo para comprobación masiva y rápida de códigos de estado HTTP.
Utiliza ThreadPoolExecutor para realizar peticiones HEAD concurrentes.
"""
from typing import List, Dict, Any
from flask import Blueprint, render_template, request, jsonify
import requests
import concurrent.futures
from apps.tools.utils import is_safe_url, safe_get_json

fast_bp = Blueprint('fast', __name__, url_prefix='/fast')

def check(url: str) -> Dict[str, Any]:
    """
    Realiza una petición HEAD a una URL para obtener su código de estado.

    Args:
        url (str): La URL a comprobar.

    Returns:
        dict: Diccionario con 'url' y 'status' (código HTTP o 'Error').
    """
    d = {'url': url, 'status': 'Error'}

    if not is_safe_url(url):
        d['status'] = 'Blocked'
        return d

    try:
        r = requests.head(url, timeout=5)
        d['status'] = r.status_code
    except Exception:
        pass
    return d

@fast_bp.route('/')
def index() -> str:
    return render_template('status_fast/dashboard.html')

@fast_bp.route('/run', methods=['POST'])
def run() -> Any:
    """
    Ejecuta la comprobación masiva de estados para una lista de URLs.

    Returns:
        JSON: Lista de resultados con URL y estado para cada una.
    """
    urls = safe_get_json().get('urls', [])
    res: List[Dict[str, Any]] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as ex:
        ft = {ex.submit(check, u): u for u in urls}
        for f in concurrent.futures.as_completed(ft):
            res.append(f.result())
    return jsonify({'status': 'ok', 'data': res})

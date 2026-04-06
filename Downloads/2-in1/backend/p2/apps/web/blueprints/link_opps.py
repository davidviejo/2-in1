"""
Módulo para detectar oportunidades de enlazado interno.
Escanea URLs en busca de menciones de palabras clave que aún no enlazan a la URL objetivo.
"""
from flask import Blueprint, render_template, request, jsonify
import requests
from bs4 import BeautifulSoup
import concurrent.futures
import re
from apps.tools.utils import is_safe_url

opps_bp = Blueprint('opps', __name__, url_prefix='/opps')

def find_opp(url, kw, target):
    """
    Busca una palabra clave en el contenido de una URL y verifica si ya enlaza al objetivo.

    Args:
        url (str): URL donde buscar.
        kw (str): Palabra clave a encontrar.
        target (str): URL objetivo a la que se debería enlazar.

    Returns:
        dict: Oportunidad encontrada con la URL y coincidencias, o None si no hay oportunidad o ya enlaza.
    """
    d = {'url': url, 'matches': []}

    if not is_safe_url(url):
        return None

    try:
        r = requests.get(url, timeout=5)
        s = BeautifulSoup(r.content, 'html.parser')
        # Si ya enlaza, ignorar
        if any(target in a.get('href','') for a in s.find_all('a')): return None

        for x in s(["script","style","nav","footer"]): x.extract()
        txt = s.get_text(" ", strip=True)
        if re.search(re.escape(kw), txt, re.I):
            d['matches'].append(f"Found '{kw}'")
    except: return None
    return d if d['matches'] else None

@opps_bp.route('/')
def index(): return render_template('opps/dashboard.html')

@opps_bp.route('/scan', methods=['POST'])
def scan():
    """
    Escanea múltiples URLs para encontrar oportunidades de enlaces.

    Request JSON:
        urls (list): Lista de URLs a escanear.
        keyword (str): Palabra clave (anchor text deseado).
        target_url (str): URL a la que se quiere enlazar.

    Returns:
        JSON: Lista de oportunidades encontradas.
    """
    j = request.json
    res = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
        ft = {ex.submit(find_opp, u, j['keyword'], j['target_url']): u for u in j['urls']}
        for f in concurrent.futures.as_completed(ft):
            r = f.result()
            if r: res.append(r)
    return jsonify({'status': 'ok', 'data': res})

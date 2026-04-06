from flask import Blueprint, render_template, request, jsonify
import requests
import logging
from bs4 import BeautifulSoup
from urllib.parse import unquote
import concurrent.futures
from apps.tools.utils import is_safe_url

prominence_bp = Blueprint('prominence', __name__, url_prefix='/prominence')

def check_prominence(url, keyword):
    """
    Analiza la prominencia de una palabra clave en una URL específica.

    El sistema de puntuación (0-100) evalúa:
    - URL: +15 si la keyword está en la dirección.
    - Title: +20 si empieza con la keyword, +10 si solo la contiene.
    - H1: +20 si aparece en el encabezado principal.
    - Intro: +15 si aparece en los primeros 300 caracteres del primer párrafo.
    - Alt Text: +10 si aparece en el atributo alt de alguna imagen.
    - Densidad: +20 si la keyword aparece entre 2 y 30 veces en el texto.

    Args:
        url (str): La URL a analizar.
        keyword (str): La palabra clave objetivo.

    Returns:
        dict: Resultado con score, checks detallados y conteo de ocurrencias.
    """
    d = {'url': url, 'keyword': keyword, 'score': 0, 'checks': {}, 'error': None}
    if not is_safe_url(url):
        d['error'] = 'URL no permitida'
        return d
    try:
        r = requests.get(url, headers={'User-Agent':'Mozilla/5.0'}, timeout=8)
        if r.status_code != 200: return {'error': 'Status '+str(r.status_code)}
        s = BeautifulSoup(r.content, 'html.parser')
        kw = keyword.lower()

        # Checks
        d['checks']['URL'] = kw in unquote(url).lower()
        if d['checks']['URL']: d['score'] += 15

        tit = s.title.string.lower() if s.title else ""
        d['checks']['Title'] = kw in tit
        if tit.startswith(kw): d['score'] += 20
        elif kw in tit: d['score'] += 10

        h1 = s.find('h1')
        d['checks']['H1'] = kw in h1.get_text().lower() if h1 else False
        if d['checks']['H1']: d['score'] += 20

        p = s.find('p')
        intro = p.get_text().lower()[:300] if p else ""
        d['checks']['Intro'] = kw in intro
        if d['checks']['Intro']: d['score'] += 15

        imgs = [i.get('alt','').lower() for i in s.find_all('img')]
        d['checks']['Alt'] = any(kw in a for a in imgs)
        if d['checks']['Alt']: d['score'] += 10

        # Densidad
        cnt = s.get_text(" ", strip=True).lower().count(kw)
        d['count'] = cnt
        if 2 <= cnt <= 30: d['score'] += 20

        d['score'] = min(100, d['score'])
    except Exception as e:
        logging.error(f"Prominence error {url}: {e}")
        d['error'] = 'Error procesando URL'
    return d

@prominence_bp.route('/')
def index(): return render_template('prominence/dashboard.html')

@prominence_bp.route('/analyze', methods=['POST'])
def analyze():
    raw = request.json.get('input_data', '')
    tasks = []
    for l in raw.split('\n'):
        p = l.split(';')
        if len(p)>=2: tasks.append((p[0].strip(), p[1].strip()))

    res = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
        ft = {ex.submit(check_prominence, t[0], t[1]): t for t in tasks}
        for f in concurrent.futures.as_completed(ft): res.append(f.result())
    return jsonify({'status': 'ok', 'data': res})

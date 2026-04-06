from flask import Blueprint, render_template, request, jsonify
import requests
import logging
from bs4 import BeautifulSoup
import concurrent.futures
from apps.tools.utils import is_safe_url

hreflang_bp = Blueprint('hreflang', __name__, url_prefix='/hreflang')

def check_hreflang(url):
    d = {'url': url, 'tags': [], 'x_default': False, 'error': None}

    if not is_safe_url(url):
        d['error'] = 'URL no permitida'
        return d

    try:
        r = requests.get(url, headers={'User-Agent':'Mozilla/5.0'}, timeout=10)
        if r.status_code == 200:
            s = BeautifulSoup(r.content, 'html.parser')
            for l in s.find_all('link', attrs={'rel':'alternate', 'hreflang':True}):
                d['tags'].append({'lang':l['hreflang'], 'url':l['href']})
                if l['hreflang'].lower() == 'x-default': d['x_default'] = True
    except Exception as e:
        logging.error(f"Hreflang error for {url}: {e}")
        d['error'] = 'Error procesando URL'
    return d

@hreflang_bp.route('/')
def index(): return render_template('hreflang/dashboard.html')

@hreflang_bp.route('/analyze', methods=['POST'])
def analyze():
    urls = request.json.get('urls', [])
    res = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex:
        ft = {ex.submit(check_hreflang, u): u for u in urls if u.strip()}
        for f in concurrent.futures.as_completed(ft): res.append(f.result())
    return jsonify({'status': 'ok', 'data': res})

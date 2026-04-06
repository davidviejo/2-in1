from flask import Blueprint, render_template, request, jsonify
import requests
import logging
from bs4 import BeautifulSoup
import concurrent.futures
from apps.tools.utils import is_safe_url

social_bp = Blueprint('social', __name__, url_prefix='/social')

def check(url):
    d = {'url': url, 'og': {'title':'', 'image':''}, 'error': None}
    if not is_safe_url(url):
        d['error'] = 'URL no permitida'
        return d
    try:
        r = requests.get(url, headers={'User-Agent':'FacebookBot'}, timeout=5)
        s = BeautifulSoup(r.content, 'html.parser')
        t = s.find('meta', property='og:title')
        i = s.find('meta', property='og:image')
        d['og']['title'] = t['content'] if t else ''
        d['og']['image'] = i['content'] if i else ''
        d['warnings'] = []
        if not d['og']['title']: d['warnings'].append("Falta og:title")
        if not d['og']['image']: d['warnings'].append("Falta og:image")
    except Exception as e:
        logging.error(f"Social error {url}: {e}")
        d['error'] = 'Error procesando URL'
    return d

@social_bp.route('/')
def index(): return render_template('social/dashboard.html')

@social_bp.route('/analyze', methods=['POST'])
def analyze():
    urls = request.json.get('urls', [])
    res = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex:
        ft = {ex.submit(check, u): u for u in urls if u.strip()}
        for f in concurrent.futures.as_completed(ft): res.append(f.result())
    return jsonify({'status':'ok', 'data':res})

from flask import Blueprint, render_template, request, jsonify
import requests
from bs4 import BeautifulSoup
import concurrent.futures
import logging
from urllib.parse import urljoin
from apps.tools.utils import is_safe_url

health_bp = Blueprint('health', __name__, url_prefix='/health')

def check(link):
    s = 0
    if not is_safe_url(link):
        return {'url': link, 'status': 'Blocked'}
    try:
        s = requests.head(link, timeout=3).status_code
    except Exception as e:
        logging.warning(f"Health check failed for {link}: {e}")
        s = 'Err'
    return {'url': link, 'status': s}

@health_bp.route('/')
def index(): return render_template('link_health/dashboard.html')

@health_bp.route('/scan', methods=['POST'])
def scan():
    url = request.json.get('url')

    if not is_safe_url(url):
        return jsonify({'error': 'URL no permitida'})

    links = []
    try:
        r = requests.get(url, timeout=5)
        s = BeautifulSoup(r.content, 'html.parser')
        for a in s.find_all('a', href=True):
            full = urljoin(url, a['href'])
            if full.startswith('http'): links.append(full)
    except Exception as e:
        logging.error(f"Scan failed for {url}: {e}")
        return jsonify({'error': 'Fail'})

    links = list(set(links))[:50] # Limit
    res = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
        ft = {ex.submit(check, l): l for l in links}
        for f in concurrent.futures.as_completed(ft): res.append(f.result())
    return jsonify({'status': 'ok', 'data': res})

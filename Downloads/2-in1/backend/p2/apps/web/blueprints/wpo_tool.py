from flask import Blueprint, render_template, request, jsonify
import requests
import concurrent.futures
from apps.tools.utils import is_safe_url

wpo_bp = Blueprint('wpo', __name__, url_prefix='/wpo')

def check_wpo(url):
    d = {'url': url, 'ttfb': 0, 'size': 0}
    if not is_safe_url(url):
        return d
    try:
        r = requests.get(url, timeout=10)
        d['ttfb'] = round(r.elapsed.total_seconds(), 3)
        d['size'] = round(len(r.content)/1024, 1)
    except: d['ttfb'] = -1
    return d

@wpo_bp.route('/')
def index(): return render_template('wpo/dashboard.html')

@wpo_bp.route('/analyze', methods=['POST'])
def analyze():
    urls = request.json.get('urls', [])
    res = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
        ft = {ex.submit(check_wpo, u): u for u in urls}
        for f in concurrent.futures.as_completed(ft): res.append(f.result())
    return jsonify({'status': 'ok', 'data': res})

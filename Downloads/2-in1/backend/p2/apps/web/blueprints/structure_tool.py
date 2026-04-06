from flask import Blueprint, render_template, request, jsonify
import requests
from bs4 import BeautifulSoup
import concurrent.futures
from apps.tools.utils import is_safe_url

structure_bp = Blueprint('structure', __name__, url_prefix='/structure')

def get_struct(url):
    d = {'url': url, 'headers': []}
    if not is_safe_url(url): return d
    try:
        r = requests.get(url, headers={'User-Agent':'Mozilla/5.0'}, timeout=5)
        s = BeautifulSoup(r.content, 'html.parser')
        for x in s(["script","style","nav","footer"]): x.extract()
        for h in s.find_all(['h1','h2','h3']):
            d['headers'].append({'tag': h.name.upper(), 'txt': h.get_text(strip=True)})
    except: pass
    return d

@structure_bp.route('/')
def index(): return render_template('structure/dashboard.html')

@structure_bp.route('/analyze', methods=['POST'])
def analyze():
    urls = (request.get_json(silent=True) or {}).get('urls', [])
    res = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex:
        ft = {ex.submit(get_struct, u): u for u in urls if u.strip()}
        for f in concurrent.futures.as_completed(ft): res.append(f.result())
    return jsonify({'status': 'ok', 'data': res})

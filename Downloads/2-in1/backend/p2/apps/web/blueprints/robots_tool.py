from flask import Blueprint, render_template, request, jsonify
import requests
from urllib.robotparser import RobotFileParser
from urllib.parse import urlparse, urljoin
import concurrent.futures
from apps.tools.utils import is_safe_url

robots_bp = Blueprint('robots', __name__, url_prefix='/robots')

def check_robots(url):
    res = {'url': url, 'can_fetch': False, 'status': 'Error'}

    if not is_safe_url(url):
        res['status'] = 'URL no permitida'
        return res

    try:
        base = f"{urlparse(url).scheme}://{urlparse(url).netloc}"
        rob_url = urljoin(base, '/robots.txt')
        rp = RobotFileParser()
        h = {'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)'}
        r = requests.get(rob_url, headers=h, timeout=5)
        if r.status_code == 200:
            rp.parse(r.text.splitlines())
            res['can_fetch'] = rp.can_fetch("Googlebot", url)
            res['status'] = 'Allowed' if res['can_fetch'] else 'Disallowed'
        else:
            res['can_fetch'] = True; res['status'] = 'No robots.txt (Allowed)'
    except Exception: pass
    return res

@robots_bp.route('/')
def index(): return render_template('robots/dashboard.html')

@robots_bp.route('/check', methods=['POST'])
def check():
    urls = request.json.get('urls', [])
    res = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
        ft = {ex.submit(check_robots, u): u for u in urls if u.strip()}
        for f in concurrent.futures.as_completed(ft): res.append(f.result())
    return jsonify({'status': 'ok', 'data': res})
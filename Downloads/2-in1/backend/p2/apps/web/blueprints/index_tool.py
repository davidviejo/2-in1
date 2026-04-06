from flask import Blueprint, render_template, request, jsonify
import requests
from bs4 import BeautifulSoup
import concurrent.futures
from urllib.parse import urljoin

index_bp = Blueprint('index_guard', __name__, url_prefix='/index_guard')

def check_indexability(url):
    data = {
        'url': url,
        'is_indexable': True,
        'status_code': 0,
        'canonical': None,
        'canonical_status': 'Missing', 
        'robots': 'index, follow', 
        'notes': []
    }
    try:
        h = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
        resp = requests.get(url, headers=h, timeout=8)
        data['status_code'] = resp.status_code
        
        if resp.status_code != 200:
            data['is_indexable'] = False
            data['notes'].append(f"Status {resp.status_code}")
            return data

        soup = BeautifulSoup(resp.content, 'html.parser')
        
        # Meta Robots
        meta = soup.find('meta', attrs={'name': 'robots'})
        if meta:
            content = meta.get('content', '').lower()
            data['robots'] = content
            if 'noindex' in content:
                data['is_indexable'] = False
                data['notes'].append("Meta Noindex")

        # Headers X-Robots-Tag
        x_robots = resp.headers.get('X-Robots-Tag')
        if x_robots and 'noindex' in x_robots.lower():
            data['is_indexable'] = False
            data['notes'].append("Header Noindex")

        # Canonical
        can = soup.find('link', rel='canonical')
        if can and can.get('href'):
            abs_can = urljoin(url, can.get('href'))
            data['canonical'] = abs_can
            if url.split('?')[0].rstrip('/') == abs_can.split('?')[0].rstrip('/'):
                data['canonical_status'] = 'Self'
            else:
                data['canonical_status'] = 'Other'
                data['is_indexable'] = False
                data['notes'].append("Canonicalizada")
        else:
            data['canonical_status'] = 'Missing'
            data['notes'].append("Falta Canonical")

    except Exception as e:
        data['is_indexable'] = False
        data['notes'].append(str(e))
    return data

@index_bp.route('/')
def index(): return render_template('index_guard/dashboard.html')

@index_bp.route('/analyze', methods=['POST'])
def analyze():
    urls = request.json.get('urls', [])
    res = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
        ft = {ex.submit(check_indexability, u): u for u in urls if u.strip()}
        for f in concurrent.futures.as_completed(ft): res.append(f.result())
    return jsonify({'status': 'ok', 'data': res})
from flask import Blueprint, render_template, request, jsonify
import requests
from bs4 import BeautifulSoup
import socket
from urllib.parse import urlparse
import concurrent.futures
from apps.tools.utils import is_safe_url

expired_bp = Blueprint('expired', __name__, url_prefix='/expired')

def check_dns(domain):
    try: socket.gethostbyname(domain); return 'Active'
    except Exception: return 'AVAILABLE'

def scan(url):
    d = {'url': url, 'found': []}
    if not is_safe_url(url):
        return d
    try:
        r = requests.get(url, headers={'User-Agent':'Mozilla/5.0'}, timeout=10)
        s = BeautifulSoup(r.content, 'html.parser')
        base = urlparse(url).netloc

        domains_to_check = set()
        for a in s.find_all('a', href=True):
            h = a['href']
            if h.startswith('http'):
                dom = urlparse(h).netloc
                if dom and dom != base:
                    domains_to_check.add(dom)

        with concurrent.futures.ThreadPoolExecutor() as executor:
            future_to_domain = {executor.submit(check_dns, domain): domain for domain in domains_to_check}
            for future in concurrent.futures.as_completed(future_to_domain):
                domain = future_to_domain[future]
                try:
                    result = future.result()
                    if result == 'AVAILABLE':
                        d['found'].append(domain)
                except Exception:
                    pass
    except Exception:
        pass
    return d

@expired_bp.route('/')
def index(): return render_template('expired/dashboard.html')

@expired_bp.route('/scan', methods=['POST'])
def run_scan():
    urls = (request.get_json(silent=True) or {}).get('urls') or []
    res = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex:
        ft = {ex.submit(scan, u): u for u in urls if isinstance(u, str) and u.strip()}
        for f in concurrent.futures.as_completed(ft): res.append(f.result())
    return jsonify({'status': 'ok', 'data': res})

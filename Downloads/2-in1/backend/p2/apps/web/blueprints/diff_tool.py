from flask import Blueprint, render_template, request, jsonify
import requests
from bs4 import BeautifulSoup

diff_bp = Blueprint('diff', __name__, url_prefix='/diff')

def get_data(url):
    d = {'status':0, 'title':'', 'h1':'', 'robots':''}
    try:
        r = requests.get(url, headers={'User-Agent':'Mozilla/5.0'}, timeout=5)
        d['status'] = r.status_code
        if r.status_code==200:
            s = BeautifulSoup(r.content, 'html.parser')
            d['title'] = s.title.string.strip() if s.title else ''
            h1 = s.find('h1')
            d['h1'] = h1.get_text(strip=True) if h1 else ''
            m = s.find('meta', attrs={'name':'robots'})
            d['robots'] = m['content'] if m else ''
    except: pass
    return d

@diff_bp.route('/')
def index(): return render_template('diff/dashboard.html')

@diff_bp.route('/compare', methods=['POST'])
def compare():
    j = request.json
    return jsonify({'status': 'ok', 'a': get_data(j['url_a']), 'b': get_data(j['url_b'])})
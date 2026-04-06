from flask import Blueprint, render_template, request, jsonify
import requests
from bs4 import BeautifulSoup

eeat_bp = Blueprint('eeat', __name__, url_prefix='/eeat')

def analyze_eeat(url):
    score = 0
    signals = []
    warnings = []
    try:
        h = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        r = requests.get(url, headers=h, timeout=8)
        s = BeautifulSoup(r.content, 'html.parser')
        txt = s.get_text().lower()

        # 1. Legal
        if any(x in txt[-3000:] for x in ['política', 'aviso legal', 'privacy', 'terms']):
            score+=2; signals.append("Enlaces Legales")
        else: warnings.append("Falta Legal")

        # 2. Sobre Nosotros
        if any(x in txt for x in ['sobre nosotros', 'quienes somos', 'about', 'contacto']):
            score+=2; signals.append("Página Sobre/Contacto")
        else: warnings.append("Falta About/Contacto")

        # 3. Schema
        html = str(s)
        if 'Person' in html or 'Organization' in html: score+=3; signals.append("Schema Autoridad")
        else: warnings.append("Sin Schema Autoridad")

        # 4. Autor
        if any(x in txt for x in ['autor:', 'escrito por', 'author']):
            score+=2; signals.append("Autoría visible")
        else: warnings.append("Sin firma de autor")

        # 5. Citas
        if any('.gov' in a.get('href','') or 'wikipedia' in a.get('href','') for a in s.find_all('a')):
            score+=1; signals.append("Citas Autoridad")

    except: pass
    return {'url': url, 'score': score, 'signals': signals, 'warnings': warnings}

@eeat_bp.route('/')
def index(): return render_template('eeat/dashboard.html')

@eeat_bp.route('/analyze_bulk', methods=['POST'])
def analyze_bulk():
    urls = request.json.get('urls', [])
    return jsonify({'status': 'ok', 'data': [analyze_eeat(u.strip()) for u in urls if u.strip()]})

from flask import Blueprint, render_template, request, jsonify
from urllib.parse import urlparse, urlencode, parse_qs, urlunparse

utm_bp = Blueprint('utm', __name__, url_prefix='/utm')

@utm_bp.route('/')
def index(): return render_template('utm/dashboard.html')

@utm_bp.route('/generate', methods=['POST'])
def generate():
    d = request.get_json(silent=True) or {}
    if not all(k in d for k in ['source', 'medium', 'campaign']):
        return jsonify({'status': 'error', 'msg': 'Missing required fields: source, medium, campaign'}), 400

    urls = d.get('urls', '').split('\n')
    res = []
    for u in urls:
        if not u.strip(): continue
        p = urlparse(u.strip())
        q = parse_qs(p.query)
        q.update({'utm_source': d['source'], 'utm_medium': d['medium'], 'utm_campaign': d['campaign']})
        res.append(urlunparse((p.scheme, p.netloc, p.path, p.params, urlencode(q, doseq=True), p.fragment)))
    return jsonify({'status': 'ok', 'urls': res})
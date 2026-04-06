from flask import Blueprint, render_template, request, jsonify
from apps.tools.utils import safe_get_json

local_bp = Blueprint('local', __name__, url_prefix='/local')

@local_bp.route('/')
def index(): return render_template('local/dashboard.html')

@local_bp.route('/generate', methods=['POST'])
def generate():
    j = safe_get_json()
    ca = [x.strip() for x in j.get('col_a','').split('\n') if x.strip()] or ['']
    cb = [x.strip() for x in j.get('col_b','').split('\n') if x.strip()] or ['']
    cc = [x.strip() for x in j.get('col_c','').split('\n') if x.strip()] or ['']
    mt = j.get('match_type', 'broad')

    res = []
    for a in ca:
        for b in cb:
            for c in cc:
                p = f"{a} {b} {c}".strip()
                if not p: continue
                if mt == 'phrase': p = f'"{p}"'
                elif mt == 'exact': p = f'[{p}]'
                elif mt == 'broad_mod': p = "+" + p.replace(" ", " +")
                res.append(p)
    return jsonify({'status': 'ok', 'count': len(res), 'keywords': res})
from flask import Blueprint, render_template, request, jsonify

roi_bp = Blueprint('roi', __name__, url_prefix='/roi')

@roi_bp.route('/')
def index(): return render_template('roi/dashboard.html')

@roi_bp.route('/calculate', methods=['POST'])
def calculate():
    try:
        j = request.get_json(silent=True) or {}
        try:
            tr = int(j.get('traffic') if j.get('traffic') is not None else 1000)
            cr = float(j.get('conv') if j.get('conv') is not None else 1.0)/100
            aov = float(j.get('aov') if j.get('aov') is not None else 50)
            gr = float(j.get('growth') if j.get('growth') is not None else 5)/100
        except (ValueError, TypeError):
            return jsonify({'status': 'error', 'msg': 'Parámetros inválidos'})
        
        proj = []
        curr = tr
        tot_rev = 0
        base = tr * cr * aov
        
        for m in range(1, 13):
            curr *= (1 + gr)
            rev = curr * cr * aov
            tot_rev += rev
            proj.append({'month': m, 'traffic': int(curr), 'orders': int(curr*cr), 'revenue': round(rev, 2), 'extra': round(max(0, rev - base), 2)})
            
        return jsonify({'status': 'ok', 'projection': proj, 'totals': {'annual_revenue': round(tot_rev, 2), 'seo_value': round(sum(p['extra'] for p in proj), 2)}})
    except Exception: return jsonify({'status': 'error', 'msg': 'Error calculando ROI'})
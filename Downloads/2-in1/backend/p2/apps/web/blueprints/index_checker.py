from flask import Blueprint, render_template, request, jsonify
from apps.tools.scraper_core import smart_serp_search
import time

indexer_bp = Blueprint('indexer', __name__, url_prefix='/indexer')

def check_url(url, cfg):
    indexed = False
    query = f"site:{url}"
    try:
        # Usamos smart_serp_search que maneja DataForSEO, Google API, Scraping y DDG
        res = smart_serp_search(query, config=cfg, num_results=1)
        if res and isinstance(res, list) and len(res) > 0:
            indexed = True
    except: pass
    return {'url': url, 'indexed': indexed}

@indexer_bp.route('/')
def index(): return render_template('indexer/dashboard.html')

@indexer_bp.route('/check', methods=['POST'])
def check():
    j = request.get_json(silent=True) or {}
    cfg = {
        'mode': j.get('mode'), 'delay': float(j.get('delay', 3)),
        'cookie': j.get('cookie'), 'key': j.get('cse_key'), 'cx': j.get('cse_cx'),
        # Mapeo extra para smart_serp_search
        'cse_key': j.get('cse_key'), 'cse_cx': j.get('cse_cx')
    }
    res = [check_url(u.strip(), cfg) for u in j.get('urls', []) if u.strip()]
    return jsonify({'status':'ok', 'data':res})

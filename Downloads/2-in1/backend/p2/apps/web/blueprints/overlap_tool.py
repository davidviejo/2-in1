"""
Módulo para el análisis de superposición (overlap) de keywords en las SERPs.
Compara los resultados de búsqueda para dos keywords distintas y determina si comparten intención de búsqueda.
"""
from flask import Blueprint, render_template, request, jsonify
import requests
from apps.tools.scraper_core import smart_serp_search

overlap_bp = Blueprint('overlap', __name__, url_prefix='/overlap')

def get_urls(kw, cfg):
    """
    Obtiene las URLs de los primeros resultados de búsqueda para una keyword.
    Utiliza smart_serp_search para soportar DataForSEO, Google, Scraping y DDG.

    Args:
        kw (str): La keyword a buscar.
        cfg (dict): Configuración que incluye 'mode', 'key', 'cx', 'cookie', etc.

    Returns:
        list: Lista de URLs encontradas en los resultados.
    """
    if cfg.get('mode') == 'serpapi':
        try:
            params = {
                "engine": "google",
                "q": kw,
                "api_key": cfg.get('key'),
                "num": 10,
                "google_domain": "google.es",
                "gl": "es",
                "hl": "es"
            }
            resp = requests.get("https://serpapi.com/search", params=params, timeout=15)
            data = resp.json()
            if "error" in data: return []
            return [r.get('link') for r in data.get('organic_results', []) if r.get('link')]
        except Exception:
            return []

    # Mapeo de parámetros para smart_serp_search
    # cfg tiene 'key' (cse_key) y 'cx' (cse_cx)
    # smart_serp_search busca 'cse_key'/'key' y 'cse_cx'/'cx'

    res = smart_serp_search(kw, config=cfg, num_results=10)
    return [r.get('url') for r in res if isinstance(r, dict) and r.get('url')]

@overlap_bp.route('/')
def index(): return render_template('overlap/dashboard.html')

@overlap_bp.route('/analyze', methods=['POST'])
def analyze():
    """
    Analiza la superposición de resultados para dos keywords.
    Calcula un 'score' basado en URLs compartidas y emite un veredicto de intención.

    Returns:
        JSON: Resultados con score (0-100), veredicto y listas de URLs.
    """
    j = request.json
    cfg = {
        'mode': j.get('mode'), 'delay': float(j.get('delay', 2)),
        'cookie': j.get('cookie'), 'key': j.get('cse_key'), 'cx': j.get('cse_cx')
    }

    ua = get_urls(j['kw_a'], cfg)
    ub = get_urls(j['kw_b'], cfg)

    common = list(set(ua).intersection(set(ub)))
    score = (len(common)/10)*100
    verdict = "Misma Intención" if score >= 60 else ("Mixta" if score >= 30 else "Diferente")

    return jsonify({'status':'ok', 'score':score, 'verdict':verdict, 'list_a':ua, 'list_b':ub, 'common':common})

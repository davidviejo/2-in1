from typing import List, Dict, Any
from flask import Blueprint, render_template, request, jsonify
import requests
from apps.tools.utils import is_safe_url

redirect_bp = Blueprint('redirect', __name__, url_prefix='/redirect')

@redirect_bp.route('/')
def index() -> str:
    """Renderiza el panel principal de la herramienta de redirecciones."""
    return render_template('redirect/dashboard.html')

@redirect_bp.route('/analyze', methods=['POST'])
def analyze() -> Any:
    """
    Analiza una lista de URLs para seguir sus redirecciones.

    Returns:
        JSON con la cadena de redirecciones para cada URL.
    """
    data = request.get_json(silent=True) or {}
    urls: List[str] = data.get('urls', [])
    res: List[Dict[str, Any]] = []

    for u in urls:
        if not isinstance(u, str) or not u.strip():
            continue

        url_clean = u.strip()

        if not is_safe_url(url_clean):
            res.append({'original': u, 'error': 'URL no permitida'})
            continue

        chain: List[Dict[str, Any]] = []
        try:
            r = requests.get(url_clean, timeout=5)
            for h in r.history:
                chain.append({'url': h.url, 'code': h.status_code})
            chain.append({'url': r.url, 'code': r.status_code})
            res.append({'original': u, 'chain': chain})
        except Exception:
            res.append({'original': u, 'error': 'Fail'})

    return jsonify({'status': 'ok', 'data': res})

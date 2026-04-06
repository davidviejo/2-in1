"""
Módulo Dorks Tool.

Proporciona una interfaz para generar consultas avanzadas de búsqueda (dorks) en Google
específicas para un dominio dado. Útil para auditorías de seguridad y SEO.
"""

from typing import Any
from flask import Blueprint, render_template, request, jsonify

dorks_bp = Blueprint('dorks', __name__, url_prefix='/dorks')

@dorks_bp.route('/')
def index() -> str:
    """Renderiza el panel principal de la herramienta Dorks."""
    return render_template('dorks/dashboard.html')

@dorks_bp.route('/generate', methods=['POST'])
def generate() -> Any:
    """
    Genera una lista de enlaces con dorks de Google para el dominio especificado.

    Recibe un JSON con:
        - domain (str): El dominio objetivo (ej: ejemplo.com).

    Retorna:
        - JSON con lista de objetos {'label': ..., 'link': ...}.
    """
    d = (request.get_json(silent=True) or {}).get('domain', '')
    base = "https://www.google.com/search?q="
    return jsonify({'status': 'ok', 'dorks': [
        {'label': 'HTTP', 'link': base + f"site:{d} -inurl:https"},
        {'label': 'Archivos', 'link': base + f"site:{d} filetype:pdf"},
        {'label': 'Subdominios', 'link': base + f"site:{d} -site:www.{d}"}
    ]})

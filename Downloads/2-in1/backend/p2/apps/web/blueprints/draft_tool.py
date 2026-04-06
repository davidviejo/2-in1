"""
Módulo Draft Tool.

Herramienta de análisis de texto simple para redacción SEO.
Calcula densidad de palabras clave, conteo de palabras y sugiere mejoras.
"""

from flask import Blueprint, render_template, request, jsonify
from collections import Counter
import re

draft_bp = Blueprint('draft', __name__, url_prefix='/draft')

@draft_bp.route('/')
def index():
    """Renderiza el panel de la herramienta Draft."""
    return render_template('draft/dashboard.html')

@draft_bp.route('/analyze', methods=['POST'])
def analyze():
    """
    Analiza un texto en relación a una palabra clave objetivo.

    Calcula:
    - Conteo total de palabras (wc).
    - Densidad de la palabra clave (dens).
    - Top 5 palabras más usadas (excluyendo stopwords comunes en español).

    Retorna:
        JSON con métricas y sugerencias sobre la densidad (baja, correcta, alta).
    """
    j = request.get_json(silent=True) or {}
    txt = j.get('text') or ''
    kw = (j.get('keyword') or '').lower()
    words = re.findall(r'\w+', txt.lower())
    wc = len(words)
    kwc = words.count(kw)
    dens = round((kwc/wc)*100, 2) if wc>0 else 0
    # Stopwords básicas en español
    stopwords = {'de', 'la', 'que', 'el', 'en', 'y', 'a', 'los', 'del', 'se', 'las', 'por', 'un', 'para', 'con', 'no', 'una', 'su', 'al', 'lo', 'como', 'más', 'pero', 'sus', 'le', 'ya', 'o', 'es', 'son', 'fue', 'era'}
    top = Counter([w for w in words if len(w)>3 and w not in stopwords]).most_common(5)

    suggestions = []
    if dens < 0.5: suggestions.append("⚠️ Densidad baja (<0.5%)")
    elif dens > 2.5: suggestions.append("⚠️ Densidad alta (>2.5%)")
    else: suggestions.append("✅ Densidad correcta")

    return jsonify({'status': 'ok', 'data': {'wc': wc, 'dens': dens, 'kwc': kwc, 'top': top, 'suggestions': suggestions}})

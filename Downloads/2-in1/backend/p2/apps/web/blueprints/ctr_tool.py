from flask import Blueprint, render_template, request, jsonify

ctr_bp = Blueprint('ctr', __name__, url_prefix='/ctr')

def score_title(title):
    """
    Calcula una puntuación de CTR (Click-Through Rate) para un título dado.

    La puntuación base es 50 y aumenta según:
    - Longitud óptima (40-60 caracteres): +10
    - Presencia de números: +10
    - Paréntesis o corchetes: +10
    - Palabras de poder (guía, mejor, gratis, etc.): +20

    Args:
        title (str): El título a analizar.

    Returns:
        dict: Diccionario con 'title', 'score' (max 100) y 'checks' (lista de mejoras encontradas).
    """
    score = 50
    checks = []
    if 40 <= len(title) <= 60:
        score += 10
    if any(x.isdigit() for x in title):
        score += 10
        checks.append("Números")
    if '[' in title or '(' in title:
        score += 10
        checks.append("Paréntesis")
    pwr = ['guía', 'mejor', 'gratis', '2025', 'top', 'barato']
    if any(w in title.lower() for w in pwr):
        score += 20
        checks.append("Power Words")
    return {'title': title, 'score': min(100, score), 'checks': checks}

@ctr_bp.route('/')
def index(): return render_template('ctr/dashboard.html')

@ctr_bp.route('/analyze', methods=['POST'])
def analyze():
    """
    Endpoint para analizar una lista de títulos en bloque.

    Espera un JSON con:
        titles (str): Cadena de texto con títulos separados por saltos de línea.

    Returns:
        JSON: Lista de resultados ordenados por puntuación descendente.
    """
    titles = ((request.get_json(silent=True) or {}).get('titles') or '').split('\n')
    return jsonify({
        'status': 'ok',
        'data': sorted([score_title(t.strip()) for t in titles if t.strip()], key=lambda x: x['score'], reverse=True)
    })

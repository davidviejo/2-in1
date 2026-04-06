from flask import Blueprint, render_template, request, jsonify
import requests
import concurrent.futures
import string
from typing import List

suggest_bp = Blueprint('suggest', __name__, url_prefix='/suggest')

def get_suggestions(query: str, lang: str = 'es') -> List[str]:
    """
    Fetches search suggestions from Google's autocomplete API.

    Args:
        query (str): The search query.
        lang (str): The language code (default: 'es').

    Returns:
        List[str]: A list of suggested search terms.
    """
    try:
        url = f"http://suggestqueries.google.com/complete/search?client=chrome&hl={lang}&q={query}"
        resp = requests.get(url, timeout=5)
        if resp.status_code == 200: return resp.json()[1]
    except Exception: pass
    return []

@suggest_bp.route('/')
def index(): return render_template('suggest/dashboard.html')

@suggest_bp.route('/mine', methods=['POST'])
def mine():
    seed = request.json.get('seed', '').strip()
    lang = request.json.get('lang', 'es')
    mode = request.json.get('mode', 'basic')
    if not seed: return jsonify({'error': 'Falta keyword'})

    queries = [seed]
    if mode == 'alpha':
        for char in string.ascii_lowercase: queries.append(f"{seed} {char}")
    elif mode == 'questions':
        for mod in ['como', 'que', 'cual', 'donde', 'precio', 'mejor']:
            queries.append(f"{mod} {seed}"); queries.append(f"{seed} {mod}")

    final_kws = set()
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        future_to_q = {executor.submit(get_suggestions, q, lang): q for q in queries}
        for future in concurrent.futures.as_completed(future_to_q):
            for s in future.result(): final_kws.add(s)

    return jsonify({'status': 'ok', 'count': len(final_kws), 'keywords': sorted(list(final_kws))})

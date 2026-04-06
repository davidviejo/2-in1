from flask import Blueprint, render_template, request, jsonify
import requests
import concurrent.futures
import logging
from typing import Dict, Any, List
from apps.tools.utils import is_safe_url

intent_bp = Blueprint('intent', __name__, url_prefix='/intent')

def classify(url: str) -> Dict[str, Any]:
    """
    Classifies the intent of a webpage (Transactional vs Informational) based on keywords.

    Args:
        url (str): The URL to analyze.

    Returns:
        Dict[str, Any]: A dictionary containing the classification type, confidence score, and signals.
    """
    data = {'url': url, 'type': '?', 'confidence': 0, 'signals': []}
    if not is_safe_url(url):
        data['signals'].append("URL no permitida")
        return data

    try:
        response = requests.get(url, headers={'User-Agent':'Mozilla/5.0'}, timeout=5)
        html_content = response.text.lower()
        scores = {'Transaccional':0, 'Informacional':0}

        if 'cart' in html_content or 'precio' in html_content or 'comprar' in html_content or 'product' in html_content: scores['Transaccional']+=5
        if 'blog' in html_content or 'article' in html_content or 'guía' in html_content: scores['Informacional']+=5

        best = max(scores, key=scores.get)
        if scores[best] > 0: data['type']=best; data['confidence']=scores[best]*10; data['signals'].append(best)
    except Exception as e:
        logging.error(f"Error classifying intent for {url}: {e}")

    return data

@intent_bp.route('/')
def index(): return render_template('intent/dashboard.html')

@intent_bp.route('/analyze', methods=['POST'])
def analyze():
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(classify, url): url for url in request.json.get('urls',[])}
        for future in concurrent.futures.as_completed(futures): results.append(future.result())
    return jsonify({'status':'ok', 'data':results})

from flask import Blueprint, render_template, request, jsonify
import requests
from bs4 import BeautifulSoup
import re
import concurrent.futures
import logging
from typing import List, Dict, Any, Optional
from apps.tools.utils import is_safe_url

nap_bp = Blueprint('nap', __name__, url_prefix='/nap')

def check(url: str, name: str, phone: str, addr: str) -> Dict[str, Any]:
    """
    Checks if a business name, phone, and address are present on a website.

    Args:
        url (str): The URL to check.
        name (str): The business name to look for.
        phone (str): The phone number to look for.
        addr (str): The address to look for.

    Returns:
        Dict[str, Any]: A dictionary containing the check results, score, and status.
    """
    result = {'url': url, 'score': 0, 'status': 'Err', 'matches': []}
    if not is_safe_url(url):
        result['status'] = 'URL no permitida'
        return result

    try:
        response = requests.get(url, headers={'User-Agent':'Mozilla/5.0'}, timeout=8)
        if response.status_code == 200:
            result['status'] = 'OK'
            txt = BeautifulSoup(response.content, 'html.parser').get_text(" ", strip=True).lower()

            # Phone (strip non-digits)
            phone_clean = re.sub(r'\D', '', str(phone))
            site_phones = re.findall(r'\+?\d[\d -]{8,15}\d', txt)
            if any(phone_clean in re.sub(r'\D', '', site_phone) for site_phone in site_phones):
                result['score']+=40; result['matches'].append("Teléfono")

            # Name
            if name.lower() in txt: result['score']+=30; result['matches'].append("Nombre")

            # Address (Fuzzy)
            if addr:
                parts = addr.split()
                hits = sum(1 for p in parts if len(p)>2 and p.lower() in txt)
                if hits/len(parts) > 0.6: result['score']+=30; result['matches'].append("Dirección")
    except Exception as e:
        logging.error(f"Error checking NAP for {url}: {e}")

    return result

@nap_bp.route('/')
def index(): return render_template('local_nap/dashboard.html')

@nap_bp.route('/check', methods=['POST'])
def check_route():
    json_data = request.json
    urls = json_data.get('urls', [])
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(check, url, json_data.get('name',''), json_data.get('phone',''), json_data.get('address','')): url for url in urls if url.strip()}
        for future in concurrent.futures.as_completed(futures): results.append(future.result())
    return jsonify({'status': 'ok', 'data': results})

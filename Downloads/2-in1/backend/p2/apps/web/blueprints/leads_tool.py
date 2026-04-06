from flask import Blueprint, render_template, request, jsonify
import requests
from bs4 import BeautifulSoup
import re
import concurrent.futures
from urllib.parse import urljoin
from apps.tools.utils import is_safe_url

leads_bp = Blueprint('leads', __name__, url_prefix='/leads')

def hunt(url):
    if not url.startswith('http'):
        url = 'https://' + url

    data = {'url': url, 'emails': [], 'social': [], 'contact': None}

    if not is_safe_url(url):
        return data

    try:
        response = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=8)
        if response.status_code == 200:
            soup = BeautifulSoup(response.content, 'html.parser')
            # Emails
            txt = soup.get_text()
            data['emails'] = list(set(re.findall(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', txt)))[:3]
            # Links
            for a in soup.find_all('a', href=True):
                href = a['href'].lower()
                if 'twitter.com' in href or 'linkedin.com' in href:
                    data['social'].append(href)
                if 'contact' in href and not data['contact']:
                    data['contact'] = urljoin(url, a['href'])
    except Exception:
        pass
    return data

@leads_bp.route('/')
def index(): return render_template('leads/dashboard.html')

@leads_bp.route('/hunt', methods=['POST'])
def run_hunt():
    urls = request.json.get('urls', [])
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        future_to_url = {executor.submit(hunt, url): url for url in urls if url.strip()}
        for future in concurrent.futures.as_completed(future_to_url):
            results.append(future.result())
    return jsonify({'status': 'ok', 'data': results})

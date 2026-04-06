from flask import Blueprint, render_template, request, jsonify, send_file
import requests
import logging
from bs4 import BeautifulSoup
from urllib.parse import urlparse
import pandas as pd
import io
import concurrent.futures
from apps.tools.utils import is_safe_url

sculpting_bp = Blueprint('sculpting', __name__, url_prefix='/sculpting')

def count(url):
    data = {'url': url, 'int': 0, 'ext': 0, 'total': 0}
    if not is_safe_url(url):
        data['error'] = 'URL no permitida'
        return data
    try:
        response = requests.get(url, timeout=5)
        soup = BeautifulSoup(response.content, 'html.parser')
        domain = urlparse(url).netloc
        for a in soup.find_all('a', href=True):
            href = a['href']
            if href.startswith('http'):
                data['total'] += 1
                if domain in href: data['int'] += 1
                else: data['ext'] += 1
    except Exception as e:
        logging.error(f"Sculpting error {url}: {e}")
        data['error'] = 'Error procesando URL'
    return data

@sculpting_bp.route('/')
def index(): return render_template('sculpting/dashboard.html')

@sculpting_bp.route('/analyze', methods=['POST'])
def analyze():
    urls = request.json.get('urls', [])
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(count, url): url for url in urls if url.strip()}
        for future in concurrent.futures.as_completed(futures): results.append(future.result())
    return jsonify({'status': 'ok', 'data': sorted(results, key=lambda x: x['total'], reverse=True)})

@sculpting_bp.route('/download', methods=['POST'])
def download():
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer: pd.DataFrame(request.json.get('data')).to_excel(writer, index=False)
    output.seek(0)
    return send_file(output, download_name='sculpting.xlsx', as_attachment=True)

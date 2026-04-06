from flask import Blueprint, render_template, request, jsonify
import requests
import socket, ssl
import logging
from urllib.parse import urlparse
from datetime import datetime
from apps.tools.utils import is_safe_url

headers_bp = Blueprint('headers', __name__, url_prefix='/headers')

def analyze_headers(url):
    data = {'url': url, 'ssl': {}, 'headers': {}, 'status': 'Error'}
    if not is_safe_url(url):
        data['status'] = 'URL no permitida'
        return data
    try:
        response = requests.head(url, headers={'User-Agent':'Mozilla/5.0'}, timeout=5)
        data['status'] = response.status_code
        data['headers'] = dict(response.headers)

        if url.startswith('https'):
            hostname = urlparse(url).netloc
            ctx = ssl.create_default_context()
            with socket.create_connection((hostname, 443)) as sock:
                with ctx.wrap_socket(sock, server_hostname=hostname) as ssock:
                    cert = ssock.getpeercert()
                    exp = datetime.strptime(cert['notAfter'], '%b %d %H:%M:%S %Y %Z')
                    data['ssl'] = {'expiry': str(exp), 'days': (exp - datetime.now()).days}
    except Exception as e:
        logging.error(f"Headers error {url}: {e}")
        data['status'] = 'Error procesando URL'
    return data

@headers_bp.route('/')
def index(): return render_template('headers/dashboard.html')

@headers_bp.route('/analyze', methods=['POST'])
def analyze():
    url = request.json.get('url')
    return jsonify({'status': 'ok', 'data': analyze_headers(url)})

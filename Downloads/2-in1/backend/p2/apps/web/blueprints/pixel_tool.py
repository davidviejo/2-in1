"""
Module for Pixel Width Tool.
Calculates the pixel width of title and meta description to check for SERP truncation.
"""
from flask import Blueprint, render_template, request, jsonify, send_file
import requests
from bs4 import BeautifulSoup
import concurrent.futures
import pandas as pd
import io
import logging
from apps.tools.utils import is_safe_url, safe_get_json

pixel_bp = Blueprint('pixel', __name__, url_prefix='/pixel')

def get_px(text, scale=1):
    """Calculates approximate pixel width of text."""
    # Aprox arial width
    return int(len(text) * 9 * scale) if text else 0

def check_px(url):
    """Fetches URL and checks pixel width of title and description."""
    data = {'url': url, 't_px': 0, 'd_px': 0}

    if not is_safe_url(url):
        data['error'] = 'URL no permitida'
        return data

    try:
        response = requests.get(url, timeout=5)
        soup = BeautifulSoup(response.content, 'html.parser')
        title = soup.title.get_text(strip=True) if soup.title else ''
        meta = soup.find('meta', attrs={'name':'description'})
        desc = (meta.get('content') or '').strip() if meta else ''
        data['t_px'] = get_px(title, 1)
        data['d_px'] = get_px(desc, 0.9)
        data['t_stat'] = 'OK' if data['t_px'] < 580 else 'Truncado'
        data['d_stat'] = 'OK' if data['d_px'] < 920 else 'Truncado'
    except Exception as e:
        logging.error(f"Error analyzing pixels for {url}: {e}")
        data['error'] = 'Error de análisis'
    return data

@pixel_bp.route('/')
def index():
    """Renders the Pixel Tool dashboard."""
    return render_template('pixel/dashboard.html')

@pixel_bp.route('/analyze', methods=['POST'])
def analyze():
    """Analyzes a list of URLs."""
    urls = safe_get_json().get('urls') or []
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(check_px, u): u for u in urls}
        for future in concurrent.futures.as_completed(futures): results.append(future.result())
    return jsonify({'status':'ok', 'data': results})

@pixel_bp.route('/download', methods=['POST'])
def download():
    """Downloads the analysis results as Excel."""
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        pd.DataFrame(safe_get_json().get('data')).to_excel(writer, index=False)
    output.seek(0)
    return send_file(output, download_name='pixel.xlsx', as_attachment=True)

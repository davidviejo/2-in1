from flask import Blueprint, render_template, request, jsonify, send_file
import requests
import logging
from bs4 import BeautifulSoup
import concurrent.futures
from urllib.parse import urlparse
import pandas as pd
import io
from apps.tools.utils import is_safe_url, sanitize_log_message

meta_gen_bp = Blueprint('meta_gen', __name__, url_prefix='/meta_gen')

def gen(url, title_template, desc_template):
    """
    Genera meta etiquetas (Title y Description) basadas en plantillas.

    Realiza un scraping de la URL para obtener el H1, el dominio y el primer párrafo.
    Sustituye los marcadores en las plantillas proporcionadas.

    Marcadores soportados:
    - {h1}: Contenido del primer H1.
    - {domain}: Nombre del dominio (sin www).
    - {intro}: Primeros 150 caracteres del primer párrafo <p>.

    Args:
        url (str): URL a procesar.
        title_template (str): Plantilla para el Title Tag.
        desc_template (str): Plantilla para la Meta Description.

    Returns:
        dict: Diccionario con 'gen_title', 'gen_desc' y 'status'.
    """
    data = {'url': url, 'gen_title': '', 'gen_desc': '', 'status': 'Err'}

    if not is_safe_url(url):
        data['status'] = 'URL no permitida'
        return data

    try:
        response = requests.get(url, timeout=5)
        soup = BeautifulSoup(response.content, 'html.parser')
        h1 = soup.find('h1').get_text(strip=True) if soup.find('h1') else ''
        domain = urlparse(url).netloc.replace('www.','')
        paragraph = soup.find('p').get_text(" ", strip=True)[:150] if soup.find('p') else ''

        data['gen_title'] = title_template.replace('{h1}', h1).replace('{domain}', domain)[:60]
        data['gen_desc'] = desc_template.replace('{h1}', h1).replace('{domain}', domain).replace('{intro}', paragraph)[:155]
        data['status'] = 'OK'
    except Exception as e:
        logging.error(f"Meta Gen Error: {sanitize_log_message(str(e))}")
    return data

@meta_gen_bp.route('/')
def index(): return render_template('meta_gen/dashboard.html')

@meta_gen_bp.route('/run', methods=['POST'])
def run():
    json_data = request.get_json(silent=True) or {}
    urls = json_data.get('urls', [])
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(gen, url, json_data.get('title_tpl', ''), json_data.get('desc_tpl', '')): url for url in urls}
        for future in concurrent.futures.as_completed(futures): results.append(future.result())
    return jsonify({'status': 'ok', 'data': results})

@meta_gen_bp.route('/download', methods=['POST'])
def download():
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer: pd.DataFrame((request.get_json(silent=True) or {}).get('data')).to_excel(writer, index=False)
    output.seek(0)
    return send_file(output, download_name='metas.xlsx', as_attachment=True)

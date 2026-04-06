from typing import List, Dict, Any, Set, Union
from flask import Blueprint, render_template, request, jsonify, send_file, Response
import requests
from bs4 import BeautifulSoup
import json
import concurrent.futures
import pandas as pd
import io
import re
from apps.tools.utils import is_safe_url

schema_detector_bp = Blueprint('schema_detector', __name__, url_prefix='/schema_detector')

def extract_types_recursive(data: Union[Dict, List], found_types: Set[str]) -> None:
    """Busca claves '@type' recursivamente"""
    if isinstance(data, dict):
        if '@type' in data:
            type_value = data['@type']
            if isinstance(type_value, list):
                found_types.update(type_value)
            else:
                found_types.add(type_value)
        for _, v in data.items():
            extract_types_recursive(v, found_types)
    elif isinstance(data, list):
        for item in data:
            extract_types_recursive(item, found_types)

def detect_schemas(url: str) -> Dict[str, Any]:
    """
    Analiza una URL para detectar esquemas estructurados (JSON-LD y Microdata).

    Args:
        url (str): La URL a analizar.

    Returns:
        dict: Diccionario con los tipos detectados, estado y payloads crudos.
    """
    result: Dict[str, Any] = {
        'url': url,
        'json_ld_types': [],
        'microdata_types': [],
        'total_count': 0,
        'status': 'Error',
        'raw_payloads': [] # Aquí guardamos el contenido real
    }

    if not is_safe_url(url):
        result['status'] = 'URL no permitida'
        return result

    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
        response = requests.get(url, headers=headers, timeout=10)

        if response.status_code == 200:
            result['status'] = 'OK'
            soup = BeautifulSoup(response.content, 'html.parser')

            # 1. JSON-LD
            json_types: Set[str] = set()
            scripts = soup.find_all('script', type='application/ld+json')
            for script in scripts:
                if script.string:
                    try:
                        clean_json = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', script.string)
                        data = json.loads(clean_json)
                        extract_types_recursive(data, json_types)
                        # Guardar el bloque completo para el desglose visual
                        result['raw_payloads'].append(data)
                    except Exception:
                        pass
            result['json_ld_types'] = sorted(list(json_types))

            # 2. MICRODATA
            micro_types: Set[str] = set()
            for tag in soup.find_all(attrs={"itemtype": True}):
                itemtype = tag['itemtype']
                name = itemtype.rstrip('/').split('/')[-1]
                micro_types.add(name)
            result['microdata_types'] = sorted(list(micro_types))

            result['total_count'] = len(result['json_ld_types']) + len(result['microdata_types'])
        else:
            result['status'] = f'HTTP {response.status_code}'

    except Exception as e:
        result['status'] = str(e)

    return result

@schema_detector_bp.route('/')
def index() -> str:
    return render_template('schema_detector/dashboard.html')

@schema_detector_bp.route('/run', methods=['POST'])
def run() -> Response:
    urls = request.json.get('urls', [])
    if not isinstance(urls, list):
        return jsonify({'error': 'Formato inválido: se espera una lista de URLs'}), 400
    urls = [u.strip() for u in urls if u.strip().startswith('http')]
    if not urls:
        return jsonify({'error': 'Falta lista de URLs'})

    data = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        future_to_url = {executor.submit(detect_schemas, u): u for u in urls}
        for future in concurrent.futures.as_completed(future_to_url):
            data.append(future.result())

    return jsonify({'status': 'ok', 'data': data})

@schema_detector_bp.route('/download', methods=['POST'])
def download() -> Response:
    data = request.json.get('data', [])
    rows = []
    for item in data:
        # Convertir a string para el Excel
        raw_str = json.dumps(item.get('raw_payloads', []), ensure_ascii=False, indent=2)
        rows.append({
            'URL': item['url'],
            'Estado': item['status'],
            'Tipos Detectados': ", ".join(item['json_ld_types'] + item['microdata_types']),
            'Detalle JSON (Código)': raw_str[:30000] # Excel tiene limite de caracteres
        })

    df = pd.DataFrame(rows)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name="Schema Inventory")
    output.seek(0)
    return send_file(output, download_name='schema_inventory.xlsx', as_attachment=True)

"""
Módulo Log Tool.

Analiza archivos de logs (formato tipo Apache/Nginx) para identificar accesos de Googlebot.
Genera estadísticas sobre códigos de estado y URLs más visitadas.
"""

from flask import Blueprint, render_template, request, jsonify, send_file
import pandas as pd
import io
import re
from collections import Counter

log_bp = Blueprint('log', __name__, url_prefix='/log')

def analyze(log_text):
    """
    Analiza un bloque de texto de logs buscando accesos de Googlebot.

    Args:
        log_text (str): Contenido crudo del archivo de log.

    Returns:
        list: Lista de diccionarios con keys 'url', 'status', 'bot'.
    """
    hits = []
    for line in log_text.split('\n'):
        if 'Googlebot' in line:
            # Extrae el método HTTP (soporta cualquier método como GET, POST, HEAD, etc.), la URL y el código de estado
            m = re.search(r'"([A-Z]+)\s+(.*?)\s+HTTP.*?"\s+(\d{3})', line)
            if m: hits.append({'url': m.group(2), 'status': int(m.group(3)), 'bot': 'Googlebot'})
    return hits

@log_bp.route('/')
def index():
    """Renderiza el panel principal de análisis de logs."""
    return render_template('log/dashboard.html')

@log_bp.route('/analyze', methods=['POST'])
def run():
    """
    Endpoint para procesar logs enviados por el usuario.

    Recibe JSON con 'logs' (str).
    Retorna estadísticas (códigos de estado, top URLs) y los hits detectados.
    """
    h = analyze(request.json.get('logs', ''))
    if not h: return jsonify({'status': 'empty'})
    sc = dict(Counter([x['status'] for x in h]))
    top = Counter([x['url'] for x in h]).most_common(10)
    return jsonify({'status': 'ok', 'data': h, 'stats': {'total_hits': len(h), 'status_codes': sc, 'top_urls': [{'url': k, 'hits': v} for k,v in top]}})

@log_bp.route('/download', methods=['POST'])
def dl():
    """
    Genera y descarga un Excel con los datos procesados.
    """
    o = io.BytesIO()
    with pd.ExcelWriter(o, engine='openpyxl') as w: pd.DataFrame(request.json.get('data')).to_excel(w, index=False)
    o.seek(0)
    return send_file(o, download_name='logs.xlsx', as_attachment=True)

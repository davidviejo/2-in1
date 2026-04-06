"""
Módulo para herramientas de migración web.
Incluye utilidades para generación de slugs y redirecciones masivas (301).
"""
from flask import Blueprint, render_template, request, jsonify
import unicodedata
import re

migration_bp = Blueprint('migration', __name__, url_prefix='/migration')

def slugify(text):
    """
    Convierte un texto en un slug amigable para URL.

    Normaliza caracteres Unicode (tildes, eñes) a ASCII y reemplaza
    caracteres no alfanuméricos por guiones.

    Args:
        text (str): Texto original.

    Returns:
        str: Slug normalizado (ej: 'Hóla Múndo' -> 'hola-mundo').
    """
    text = unicodedata.normalize('NFKD', str(text).lower()).encode('ascii', 'ignore').decode('utf-8')
    return re.sub(r'[^a-z0-9]+', '-', text).strip('-')

@migration_bp.route('/')
def index():
    """
    Renderiza la interfaz principal del dashboard de migración.
    """
    return render_template('migration/dashboard.html')

@migration_bp.route('/slugify_bulk', methods=['POST'])
def slug():
    """
    Procesa una lista de títulos y los convierte a slugs URL-friendly.
    """
    titles = request.json.get('titles', [])
    return jsonify({'status': 'ok', 'data': [{'slug': slugify(t)} for t in titles if t.strip()]})

@migration_bp.route('/generate_redirects', methods=['POST'])
def redir():
    """
    Genera reglas de redirección 301 para servidores web.

    Soporta formatos:
    - Apache (.htaccess): Redirect 301 /old /new
    - Nginx (nginx.conf): rewrite ^/old$ /new permanent;
    - CSV: /old,/new

    Args (JSON):
        pairs (str): Lista de pares URL antigua y nueva separados por espacio/tab, uno por línea.
        server (str): Tipo de servidor ('apache', 'nginx', 'csv').

    Returns:
        JSON: Código generado en el campo 'code'.
    """
    pairs = request.json.get('pairs', '').split('\n')
    server_type = request.json.get('server', 'apache')
    code = ""
    for p in pairs:
        pt = p.strip().split()
        if len(pt) >= 2:
            if server_type == 'apache':
                code += f"Redirect 301 {pt[0]} {pt[1]}\n"
            elif server_type == 'nginx':
                code += f"rewrite ^{pt[0]}$ {pt[1]} permanent;\n"
            else:
                code += f"{pt[0]},{pt[1]}\n"
    return jsonify({'status': 'ok', 'code': code})

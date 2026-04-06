"""
Módulo Ops Cleaner.

Proporciona utilidades para limpieza y procesamiento masivo de texto y listas.
Soporta operaciones como deduplicación, extracción de URLs, limpieza de parámetros, etc.
"""

from flask import Blueprint, render_template, request, jsonify
import re
from urllib.parse import urlparse

cleaner_bp = Blueprint('cleaner', __name__, url_prefix='/cleaner')

@cleaner_bp.route('/')
def index():
    """Renderiza la interfaz de limpieza de datos."""
    return render_template('ops/cleaner.html')

@cleaner_bp.route('/process', methods=['POST'])
def process():
    """
    Procesa un bloque de texto según el modo seleccionado.

    Modos soportados:
    - deduplicate: Elimina líneas duplicadas manteniendo orden.
    - extract_urls: Extrae enlaces http/https del texto sucio.
    - clean_params: Elimina query strings (?) y fragmentos (#) de las URLs.
    - extract_domains: Extrae solo el dominio (host) de las URLs.
    - lowercase: Convierte todo a minúsculas.
    - extract_emails: Extrae direcciones de correo electrónico.

    Retorna:
        JSON con los datos procesados unidos por saltos de línea y el conteo total.
    """
    raw_text = request.json.get('text', '')
    mode = request.json.get('mode', 'deduplicate')

    # Separar por líneas y limpiar espacios
    lines = [l.strip() for l in raw_text.split('\n') if l.strip()]
    result = []

    if mode == 'deduplicate':
        # Eliminar duplicados manteniendo el orden original
        seen = set()
        result = [x for x in lines if not (x in seen or seen.add(x))]

    elif mode == 'extract_urls':
        # Regex para encontrar http/https dentro de texto sucio
        text_blob = " ".join(lines)
        # Patrón simple para URLs
        urls = re.findall(r'https?://[^\s<>"]+|www\.[^\s<>"]+', text_blob)
        # Limpiar y deduplicar
        result = sorted(list(set([u.rstrip(',.;') for u in urls])))

    elif mode == 'clean_params':
        # Quitar query strings (?utm=...) y anclas (#header)
        cleaned = []
        for l in lines:
            # Si no tiene http, lo intentamos arreglar o lo saltamos
            if not l.startswith('http') and not l.startswith('www'): continue

            # Split por ? y #
            clean_url = l.split('?')[0].split('#')[0]
            cleaned.append(clean_url)
        result = sorted(list(set(cleaned)))

    elif mode == 'extract_domains':
        # Sacar solo el host (ej: google.com)
        domains = []
        for l in lines:
            try:
                # Asegurar esquema para que urlparse funcione
                if not l.startswith('http'): l = 'http://' + l
                dom = urlparse(l).netloc.replace('www.', '')
                if dom: domains.append(dom)
            except Exception: pass
        result = sorted(list(set(domains)))

    elif mode == 'lowercase':
        result = [l.lower() for l in lines]

    elif mode == 'extract_emails':
        text_blob = " ".join(lines)
        emails = re.findall(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', text_blob)
        result = sorted(list(set(emails)))

    return jsonify({
        'status': 'ok',
        'count': len(result),
        'data': "\n".join(result)
    })

"""
Módulo para la visualización de grafos de enlaces internos.
Permite construir y visualizar la estructura de interconexión entre URLs de un mismo dominio.
"""
from flask import Blueprint, render_template, request, jsonify
import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse, urljoin
import concurrent.futures
from apps.tools.utils import is_safe_url

graph_bp = Blueprint('graph', __name__, url_prefix='/graph')

def get_links(url, domain):
    """
    Obtiene todos los enlaces internos de una URL dada que pertenecen al mismo dominio.

    Args:
        url (str): La URL a analizar.
        domain (str): El dominio base para filtrar enlaces internos.

    Returns:
        list: Lista de URLs únicas encontradas.
    """
    links = set()
    if not is_safe_url(url):
        return []
    try:
        response = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=5)
        soup = BeautifulSoup(response.content, 'html.parser')
        for a in soup.find_all('a', href=True):
            full = urljoin(url, a['href']).split('#')[0].rstrip('/')
            if urlparse(full).netloc == domain:
                links.add(full)
    except Exception:
        pass
    return list(links)

@graph_bp.route('/')
def index(): return render_template('graph/dashboard.html')

@graph_bp.route('/build', methods=['POST'])
def build():
    """
    Construye el grafo de enlaces a partir de una lista de URLs.

    Procesa las URLs en paralelo para extraer enlaces y generar nodos y aristas
    para la visualización.

    Returns:
        JSON: Datos de nodos y aristas para la librería de visualización (ej. VisJS).
    """
    urls = (request.get_json(silent=True) or {}).get('urls', [])
    if not urls:
        return jsonify({'error': 'Pon URLs'})

    domain = urlparse(urls[0]).netloc
    nodes, edges = [], []
    adjacency_list = {}

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        future_to_url = {executor.submit(get_links, url, domain): url for url in urls}
        for future in concurrent.futures.as_completed(future_to_url):
            url = future_to_url[future]
            adjacency_list[url] = future.result()

    inlinks = {url: 0 for url in urls}
    for src, targets in adjacency_list.items():
        for tgt in targets:
            if tgt in urls and src != tgt:
                edges.append({'from': src, 'to': tgt, 'arrows': 'to'})
                inlinks[tgt] += 1

    for url in urls:
        inlink_count = inlinks.get(url, 0)
        color = '#ff0000' if inlink_count == 0 else ('#00ff00' if inlink_count > 10 else '#97c2fc')
        nodes.append({'id': url, 'label': urlparse(url).path, 'value': inlink_count + 1, 'color': color, 'title': url})

    return jsonify({'status': 'ok', 'nodes': nodes, 'edges': edges})

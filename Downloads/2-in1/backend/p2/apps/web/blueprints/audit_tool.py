"""
Módulo de Auditoría SEO Híbrida.
Combina análisis estático (requests) y dinámico (Playwright) para auditar URLs.
Extrae metadatos básicos, detecta thin content y problemas de renderizado.
"""
from flask import Blueprint, render_template, request, jsonify, send_file
# Importamos la función del scraper core
from apps.tools.scraper_core import fetch_url_hybrid
from apps.tools.utils import is_safe_url
from bs4 import BeautifulSoup
import pandas as pd
import io
import concurrent.futures
import logging
import requests
import xml.etree.ElementTree as ET

audit_bp = Blueprint('audit', __name__, url_prefix='/audit')

def fetch_sitemap_urls(sitemap_url):
    """Expande recursivamente un sitemap (index o urlset) y devuelve URLs finales deduplicadas."""
    if not is_safe_url(sitemap_url):
        return []

    def _local_name(tag):
        return tag.split('}', 1)[1] if '}' in tag else tag

    headers = {'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)'}
    to_visit = [sitemap_url]
    visited_sitemaps = set()
    final_urls = set()
    max_collected_urls = 5000

    while to_visit:
        current_sitemap = to_visit.pop()
        if current_sitemap in visited_sitemaps:
            continue
        visited_sitemaps.add(current_sitemap)

        if not is_safe_url(current_sitemap):
            continue

        try:
            response = requests.get(current_sitemap, headers=headers, timeout=10)
        except Exception:
            continue

        if response.status_code != 200:
            continue

        try:
            root = ET.fromstring(response.content)
        except ET.ParseError:
            if current_sitemap == sitemap_url:
                return []
            continue

        root_name = _local_name(root.tag).lower()
        if root_name == 'sitemapindex':
            for sitemap_node in root.findall('.//{*}sitemap'):
                loc_node = sitemap_node.find('{*}loc')
                if loc_node is None or not loc_node.text:
                    continue
                next_sitemap = loc_node.text.strip()
                if not next_sitemap or not is_safe_url(next_sitemap):
                    continue
                if next_sitemap not in visited_sitemaps:
                    to_visit.append(next_sitemap)
        elif root_name == 'urlset':
            for url_node in root.findall('.//{*}url'):
                loc_node = url_node.find('{*}loc')
                if loc_node is None or not loc_node.text:
                    continue
                final_url = loc_node.text.strip()
                if final_url:
                    final_urls.add(final_url)
                    if len(final_urls) >= max_collected_urls:
                        return list(final_urls)
        elif current_sitemap == sitemap_url:
            return []

    return list(final_urls)

def analyze_single_url_hybrid(url):
    """
    Analiza una URL individual utilizando una estrategia híbrida.
    Intenta primero con requests, y si falla o detecta JS, usa Playwright.

    Args:
        url (str): URL a analizar.

    Returns:
        dict: Diccionario con métricas SEO (título, H1, palabras, notas, método usado).
    """
    result = {
        'url': url,
        'status': 0,
        'method': 'Requests',
        'title': '',
        'h1': '',
        'words': 0,
        'notes': []
    }

    if not is_safe_url(url):
        result['notes'].append("URL no permitida")
        return result

    # Usamos el scraper híbrido (0.5s delay para ir fluido)
    response_data = fetch_url_hybrid(url, delay=0.5)

    result['status'] = response_data['status']
    result['method'] = response_data.get('method', 'Unknown')

    if response_data['content']:
        try:
            soup = BeautifulSoup(response_data['content'], 'html.parser')

            if soup.title: result['title'] = soup.title.string.strip()

            h1 = soup.find('h1')
            if h1: result['h1'] = h1.get_text(strip=True)
            else: result['notes'].append("Falta H1")

            meta = soup.find('meta', attrs={'name': 'description'})
            if meta: result['meta_desc'] = meta.get('content', '').strip()
            else: result['notes'].append("Falta Meta Desc")

            # Limpieza para contar palabras
            for x in soup(["script", "style", "nav", "footer", "svg"]): x.extract()
            txt = soup.get_text(separator=' ')
            result['words'] = len([w for w in txt.split() if len(w)>1])

            if result['words'] < 300: result['notes'].append("Thin Content")

            # Marca si se usó JS (útil para saber si la web depende de renderizado cliente)
            if result['method'] == 'Playwright (JS)':
                result['notes'].append("Renderizado JS")

        except Exception as e:
            logging.error(f"Error parsing URL {url}: {e}", exc_info=True)
            result['notes'].append("Error interno de análisis")
    else:
        if response_data['status'] != 200:
            result['notes'].append(f"Error HTTP {response_data['status']}")
        elif response_data.get('error'):
            logging.error(f"Scraper error for {url}: {response_data['error']}")
            result['notes'].append("Error de conexión/scraper")

    return result

@audit_bp.route('/')
def index(): return render_template('audit/dashboard.html')

@audit_bp.route('/scan', methods=['POST'])
def scan():
    """
    Endpoint para iniciar el escaneo de auditoría.
    Acepta una URL individual o un Sitemap XML.

    Form Data:
        sitemap_url (str): URL a escanear (página única o .xml).

    Returns:
        JSON: Resultados del análisis.
    """
    url_input = request.form.get('sitemap_url')
    if not url_input: return jsonify({'error': 'Falta URL'})

    if not is_safe_url(url_input):
        return jsonify({'error': 'URL no permitida'})

    # Si parece sitemap, intentamos expandirlo; si no, auditamos como URL única
    looks_like_sitemap = 'sitemap' in url_input.lower() or url_input.lower().endswith('.xml')
    if looks_like_sitemap:
        urls = fetch_sitemap_urls(url_input)
        urls = urls[:50] # Limitamos a 50 para la demo
    else:
        urls = [url_input]

    if not urls:
        if looks_like_sitemap:
            return jsonify({'error': 'No se pudo leer sitemap o sitemap vacío'})
        return jsonify({'error': 'No se pudo procesar la URL'})

    results = []
    # Paralelismo controlado
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        future_to_url = {executor.submit(analyze_single_url_hybrid, url): url for url in urls}
        for future in concurrent.futures.as_completed(future_to_url):
            results.append(future.result())

    return jsonify({'status': 'ok', 'total': len(urls), 'data': results})

@audit_bp.route('/download_report', methods=['POST'])
def download():
    data = request.json.get('data')
    df = pd.DataFrame(data)
    if 'notes' in df.columns: df['notes'] = df['notes'].apply(lambda x: ", ".join(x) if isinstance(x, list) else x)
    output_stream = io.BytesIO()
    with pd.ExcelWriter(output_stream, engine='openpyxl') as writer: df.to_excel(writer, index=False, sheet_name="Audit Hybrid")
    output_stream.seek(0)
    return send_file(output_stream, download_name='audit_hybrid.xlsx', as_attachment=True)

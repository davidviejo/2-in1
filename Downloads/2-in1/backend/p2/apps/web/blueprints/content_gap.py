from typing import List, Dict, Any, Optional
from flask import Blueprint, render_template, request, jsonify, send_file
import requests
import concurrent.futures
from bs4 import BeautifulSoup
from collections import Counter
import re
import statistics
import pandas as pd
import io
from apps.tools.utils import is_safe_url

gap_bp = Blueprint('gap', __name__, url_prefix='/gap')

# --- UTILIDADES ---
def get_text_content(url: str) -> List[str]:
    """
    Fetches the text content of a URL, cleaning HTML tags and filtering
    stopwords.

    Args:
        url (str): The URL to fetch.

    Returns:
        list: A list of relevant words (lowercased, >2 chars, non-digit) found in the page content.
    """
    if not is_safe_url(url):
        return []

    try:
        h = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'}
        r = requests.get(url, headers=h, timeout=6)
        if r.status_code != 200:
            return []

        soup = BeautifulSoup(r.content, 'html.parser')
        for x in soup(["script", "style", "nav", "footer", "svg", "header", "form", "iframe", "button"]):
            x.extract()

        text = soup.get_text(separator=' ')
        words = re.findall(r'\w+', text.lower())

        stopwords = {'de', 'la', 'que', 'el', 'en', 'y', 'a', 'los', 'del', 'se', 'las', 'por', 'un', 'para', 'con', 'no', 'una', 'su', 'al', 'lo', 'como', 'más', 'pero', 'sus', 'le', 'ya', 'o', 'este', 'sí', 'porque', 'esta', 'entre', 'cuando', 'muy', 'sin', 'sobre', 'también', 'me', 'hasta', 'hay', 'donde', 'quien', 'desde', 'todo', 'nos', 'durante', 'todos', 'uno', 'les', 'ni', 'contra', 'otros', 'ese', 'eso', 'ante', 'ellos', 'e', 'esto', 'mí', 'antes', 'algunos', 'qué', 'unos', 'yo', 'otro', 'otras', 'otra', 'él', 'tanto', 'esa', 'estos', 'mucho', 'quienes', 'nada', 'muchos', 'cual', 'poco', 'ella', 'estar', 'estas', 'algunas', 'algo', 'nosotros', 'mi', 'mis', 'tú', 'te', 'ti', 'tu', 'tus', 'ellas', 'nosotras', 'vosotros', 'vosotras', 'os', 'mío', 'mía', 'míos', 'mías', 'tuyo', 'tuya', 'tuyos', 'tuyas', 'suyo', 'suya', 'suyos', 'suyas', 'nuestro', 'nuestra', 'nuestros', 'nuestras', 'vuestro', 'vuestra', 'vuestros', 'vuestras', 'es', 'son', 'fue', 'era', 'ser', 'está', 'están'}

        return [w for w in words if w not in stopwords and len(w) > 2 and not w.isdigit()]
    except Exception:
        return []

# --- RUTAS ---

@gap_bp.route('/')
def index() -> str:
    return render_template('gap/dashboard.html')

@gap_bp.route('/analyze', methods=['POST'])
def analyze() -> Any:
    """
    Analiza la brecha de contenido (Content Gap) entre una URL propia y varias de la competencia.
    Calcula la frecuencia de palabras y compara el uso entre el sitio propio y los competidores.
    """
    data = request.get_json(silent=True) or {}
    if not data:
        return jsonify({'error': 'JSON inválido o vacío'})
    my_url = data.get('my_url')
    comp_urls_raw = data.get('comp_urls', [])

    if not my_url or not comp_urls_raw:
        return jsonify({'error': 'Faltan URLs'})

    # 1. MI URL
    my_words = get_text_content(my_url)
    if not my_words:
        return jsonify({'error': 'Error leyendo tu URL (o no permitida)'})
    my_counter = Counter(my_words)

    # 2. COMPETENCIA
    comp_data: List[Dict[str, Any]] = [] # Lista de diccionarios [{'url': '...', 'counter': Counter, 'total': 100}]

    clean_urls = [url.strip() for url in comp_urls_raw if url.strip()]

    def process_comp_url(url: str) -> Optional[Dict[str, Any]]:
        """Procesa una URL de competencia: extrae texto y cuenta palabras."""
        w = get_text_content(url)
        if w:
            return {
                'url': url,
                'counter': Counter(w),
                'total': len(w)
            }
        return None

    with concurrent.futures.ThreadPoolExecutor() as executor:
        results = executor.map(process_comp_url, clean_urls)

    for res in results:
        if res:
            comp_data.append(res)

    if not comp_data:
        return jsonify({'error': 'Error leyendo competencia'})

    # 3. CALCULAR GAP DETALLADO
    # Identificamos palabras usadas por la competencia para comparar frecuencias.
    all_words = set()
    for c in comp_data:
        all_words.update(c['counter'].keys())

    results_list = []
    for word in all_words:
        my_count = my_counter.get(word, 0)

        # Extraer conteo individual por competidor
        breakdown = []
        counts_list = []

        for c in comp_data:
            val = c['counter'].get(word, 0)
            counts_list.append(val)
            breakdown.append(val) # Guardamos el valor ordenado

        avg_count = statistics.mean(counts_list)
        max_count = max(counts_list)

        if avg_count < 1.5 and max_count < 3:
            continue

        status = 'OK'
        if my_count == 0:
            status = '❌ Faltante'
        elif my_count < avg_count * 0.4:
            status = '⚠️ Bajo'
        elif my_count > avg_count * 3:
            status = '🔵 Alto'
        else:
            status = '✅ Bien'

        results_list.append({
            'word': word,
            'my_count': my_count,
            'comp_breakdown': breakdown, # [2, 5, 0] -> Conteos de cada competidor
            'comp_avg': round(avg_count, 1),
            'status': status
        })

    results_list.sort(key=lambda x: (x['my_count'] > 0, -x['comp_avg']))

    # Enviar también las URLs limpias para las cabeceras de la tabla
    clean_comp_urls = [c['url'] for c in comp_data]

    return jsonify({
        'status': 'ok',
        'data': results_list[:200],
        'comp_headers': clean_comp_urls, # Para pintar la tabla
        'metrics': {
            'my_words': len(my_words),
            'comp_words_avg': int(statistics.mean([c['total'] for c in comp_data]))
        }
    })

@gap_bp.route('/download', methods=['POST'])
def download() -> Any:
    req = request.get_json(silent=True) or {}
    rows = req.get('data', [])
    headers = req.get('headers', []) # URLs de competidores

    export_data = []
    for r in rows:
        row = {
            'Palabra Clave': r['word'],
            'Diagnóstico': r['status'],
            'Mi Web (Rep)': r['my_count'],
            'Media Competencia': r['comp_avg']
        }
        # Añadir columnas dinámicas
        for i, val in enumerate(r['comp_breakdown']):
            col_name = headers[i] if i < len(headers) else f"Comp {i+1}"
            row[col_name] = val

        export_data.append(row)

    df = pd.DataFrame(export_data)

    # Reordenar columnas para que queden bonitas
    cols = ['Palabra Clave', 'Diagnóstico', 'Mi Web (Rep)'] + headers + ['Media Competencia']
    # Filtrar por si acaso alguna columna no coincide exactamente
    final_cols = [c for c in cols if c in df.columns]
    df = df[final_cols]

    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name="Gap Analysis")
    output.seek(0)

    return send_file(output, download_name='content_gap.xlsx', as_attachment=True)

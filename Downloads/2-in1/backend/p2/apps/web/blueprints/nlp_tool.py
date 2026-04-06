from flask import Blueprint, render_template, request, jsonify
import logging
# Importamos nuestro nuevo núcleo
from apps.tools.scraper_core import get_soup
from apps.tools.utils import validate_url
import re
from collections import Counter
from typing import List, Dict, Any
import spacy

nlp_bp = Blueprint('nlp', __name__, url_prefix='/nlp')

# Cargar modelo de español de forma segura
try:
    nlp_engine = spacy.load("es_core_news_sm")
except OSError:
    logging.warning("Modelo Spacy no encontrado. Usando modo básico.")
    nlp_engine = None

def get_ngrams(text: str, n: int = 2) -> List[str]:
    """
    Generates n-grams from the given text.

    Args:
        text (str): The input text.
        n (int): The number of words in each n-gram. Defaults to 2.

    Returns:
        list: A list of n-gram strings.
    """
    words = re.findall(r'\w+', text.lower())
    words = [w for w in words if len(w) > 2]
    return [" ".join(words[i:i+n]) for i in range(len(words)-n+1)]

def analyze_semantics_advanced(url: str) -> Dict[str, Any]:
    """
    Realiza un análisis semántico avanzado de una URL.

    Extrae el contenido de la URL, limpia el texto y utiliza Spacy (si está disponible)
    para detectar entidades nombradas y verbos. También calcula métricas de legibilidad
    y bigramas frecuentes.

    Args:
        url (str): La URL a analizar.

    Returns:
        dict: Diccionario con métricas de análisis (conteo de palabras, entidades, legibilidad, etc.).
    """
    data = {
        'url': url,
        'error': None,
        'word_count': 0,
        'sentiment': 0,
        'subjectivity': 0,
        'sent_label': '-',
        'readability_label': '-',
        'readability_score': 0,
        'top_bigrams': [],
        'top_entities': [],
        'verb_count': 0
    }

    # Usamos el Scraper Híbrido (Requests -> Playwright)
    # Intenta obtener el contenido de la página usando una estrategia robusta
    soup = get_soup(url, delay=1)

    if not soup:
        data['error'] = "No se pudo acceder a la URL o bloqueo detectado"
        return data

    # Limpieza
    for x in soup(["script", "style", "nav", "footer", "svg"]): x.extract()
    clean_text = " ".join(soup.get_text(separator=' ').split())

    if len(clean_text) < 50:
        data['error'] = "Texto insuficiente para analizar"
        return data

    data['word_count'] = len(clean_text.split())

    # --- ANÁLISIS CON SPACY (IA) ---
    if nlp_engine:
        # Procesar texto (puede tardar un poco si es muy largo)
        # Cortamos a 100.000 caracteres para evitar crash y limitar consumo de memoria
        doc = nlp_engine(clean_text[:100000])

        # 1. Entidades (Personas, Organizaciones, Lugares)
        # Filtramos etiquetas relevantes
        relevant_labels = ['PER', 'ORG', 'LOC', 'MISC']
        entities = [ent.text for ent in doc.ents if ent.label_ in relevant_labels]
        data['top_entities'] = Counter(entities).most_common(10)

        # 2. Sintaxis (Verbos)
        verbs = [token.text for token in doc if token.pos_ == "VERB"]
        data['verb_count'] = len(verbs)
    else:
        # Fallback si Spacy no está disponible
        data['top_entities'] = [("Modelo Spacy no cargado", 0)]

    # --- ANÁLISIS CLÁSICO (N-GRAMAS Y LEGIBILIDAD) ---
    data['top_bigrams'] = Counter(get_ngrams(clean_text, 2)).most_common(8)

    # Cálculo simple de legibilidad (Flesch-Szigriszt simplificado)
    sentences = max(1, clean_text.count('.') + clean_text.count('!'))
    words = len(re.findall(r'\w+', clean_text))
    syllables = len(re.findall(r'[aeiouáéíóúü]', clean_text.lower()))

    score = 206.84 - (60 * (syllables/words)) - (1.02 * (words/sentences))
    data['readability_score'] = round(score, 1)

    if score > 60: data['readability_label'] = "Fácil"
    elif score > 40: data['readability_label'] = "Normal"
    else: data['readability_label'] = "Difícil"

    return data

@nlp_bp.route('/')
def index(): return render_template('nlp/dashboard.html')

@nlp_bp.route('/analyze_bulk', methods=['POST'])
def analyze_bulk():
    """
    Analiza una lista de URLs en busca de datos semánticos y métricas de legibilidad.
    Procesa las URLs secuencialmente para controlar el uso de recursos.
    """
    urls = request.json.get('urls', [])
    if not isinstance(urls, list):
        return jsonify({'error': 'Formato inválido, se espera una lista de URLs'}), 400

    # Procesamiento secuencial para no saturar la CPU con Spacy
    results = []
    for u in urls:
        if isinstance(u, str) and u.strip() and validate_url(u.strip()):
            results.append(analyze_semantics_advanced(u.strip()))
    return jsonify({'status': 'ok', 'data': results})

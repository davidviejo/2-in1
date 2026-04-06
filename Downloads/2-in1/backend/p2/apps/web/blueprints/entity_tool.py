# apps/entity_tool.py
"""
Módulo para reconocimiento de entidades nombradas (NER).
Utiliza Spacy para detectar personas, organizaciones y lugares en textos o URLs.
"""
from flask import Blueprint, render_template, request, jsonify
import spacy
import logging
import requests
from bs4 import BeautifulSoup

entity_bp = Blueprint('entity_bp', __name__)

# Cargar modelo de lenguaje en español (optimizado para CPU)
try:
    nlp = spacy.load("es_core_news_sm")
except:
    # Fallback por si no lo han descargado
    logging.warning("Modelo 'es_core_news_sm' no encontrado. Ejecuta: python -m spacy download es_core_news_sm")
    nlp = None

def extract_content_from_url(url):
    """
    Descarga y extrae el texto principal de una URL.

    Args:
        url (str): La URL a analizar.

    Returns:
        str: El texto extraído y limpio, o None si hubo error.
    """
    try:
        headers = {'User-Agent': 'Mozilla/5.0'}
        resp = requests.get(url, headers=headers, timeout=10)
        soup = BeautifulSoup(resp.text, 'html.parser')

        # Eliminar scripts y estilos
        for script in soup(["script", "style", "nav", "footer"]):
            script.decompose()

        return soup.get_text(" ", strip=True)[:100000] # Limite caracteres
    except Exception:
        return None

@entity_bp.route('/entities/dashboard')
def dashboard():
    return render_template('entities/dashboard.html')

@entity_bp.route('/entities/analyze', methods=['POST'])
def analyze():
    """
    Endpoint para análisis de entidades.

    Acepta texto crudo o una URL, extrae entidades usando Spacy y
    las clasifica por tipo (PER, ORG, LOC, MISC).

    Returns:
        JSON: Lista de entidades detectadas agrupadas por tipo.
    """
    if not nlp:
        return jsonify({"error": "Modelo Spacy no instalado en el servidor."})

    text = request.form.get('text', '')
    url = request.form.get('url', '')

    # Si hay URL, priorizar descargar su contenido
    if url:
        scraped_text = extract_content_from_url(url)
        if scraped_text:
            text = scraped_text
        else:
            return jsonify({"error": "No se pudo leer la URL."})

    if not text:
        return jsonify({"error": "Introduce texto o una URL válida."})

    # Procesamiento NLP
    doc = nlp(text)

    # Clasificación de Entidades
    entities = {
        "PER": [], # Personas
        "ORG": [], # Empresas / Organizaciones
        "LOC": [], # Lugares
        "MISC": [] # Conceptos Varios (Productos, Eventos...)
    }

    # Contenedor para conteo de frecuencia
    counts = {}

    for ent in doc.ents:
        clean_text = ent.text.strip().title()
        label = ent.label_

        # Filtrar basura corta
        if len(clean_text) < 2: continue

        # Mapear etiquetas de Spacy a nuestras categorías
        category = "MISC"
        if label in ["PER", "PERSON"]: category = "PER"
        elif label in ["ORG"]: category = "ORG"
        elif label in ["LOC", "GPE"]: category = "LOC"

        # Conteo
        if clean_text in counts:
            counts[clean_text]['count'] += 1
        else:
            counts[clean_text] = {'text': clean_text, 'count': 1, 'type': category}

    # Organizar resultados en listas
    sorted_ents = sorted(counts.values(), key=lambda x: x['count'], reverse=True)

    for item in sorted_ents:
        entities[item['type']].append(item)

    return jsonify({
        "status": "success",
        "data": entities,
        "total_analyzed": len(doc.ents)
    })

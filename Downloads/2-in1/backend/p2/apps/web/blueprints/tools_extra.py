"""
Módulo de herramientas extra para SEO y estructuración de datos.
Incluye simulador de SERP, generador de Schema y generador de FAQ Schema.
"""
from flask import Blueprint, render_template, request, jsonify
import json
from apps.tools.utils import safe_get_json

extra_bp = Blueprint('extra', __name__, url_prefix='/extra')

@extra_bp.route('/serp_sim')
def serp_sim():
    """Renderiza el simulador de SERP (resultados de búsqueda)."""
    return render_template('extra/serp_sim.html')

@extra_bp.route('/schema_gen')
def schema_gen():
    """Renderiza la herramienta de generación de marcado Schema."""
    return render_template('extra/schema_gen.html')

@extra_bp.route('/generate_faq_schema', methods=['POST'])
def gen_faq():
    """
    Genera JSON-LD para Schema de tipo FAQPage.

    Recibe una lista de preguntas y respuestas y devuelve el JSON estructurado.
    """
    questions = safe_get_json().get('questions', [])
    schema_data = {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": []}
    for item in questions:
        schema_data["mainEntity"].append({
            "@type": "Question",
            "name": item['q'],
            "acceptedAnswer": {"@type": "Answer", "text": item['a']}
        })
    return jsonify({'json_ld': json.dumps(schema_data, indent=4)})

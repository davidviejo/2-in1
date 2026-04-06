# apps/ai_fixer.py
from flask import Blueprint, request, jsonify
from apps.tools.llm_service import query_llm

ai_bp = Blueprint('ai_bp', __name__)

def generate_with_gpt(prompt):
    """
    Conecta con el servicio de IA unificado (por defecto OpenAI para este módulo).
    """
    # Mantenemos 'openai' como default para compatibilidad con la versión anterior de este módulo
    return query_llm(prompt, provider='openai')

@ai_bp.route('/ai/fix_issue', methods=['POST'])
def fix_issue():
    """
    Endpoint para corregir problemas SEO utilizando IA.

    Genera prompts específicos según el tipo de problema detectado:
    - 'meta_missing': Genera una meta descripción.
    - 'title_length': Reescribe el título para ajustar la longitud.
    - 'h1_missing': Genera un H1 optimizado.
    - 'no_alt': Genera texto ALT para imágenes.

    Args (JSON):
        issue (str): Tipo de problema.
        context (str): Texto de contexto (ej. contenido actual, H1 existente).
        kw (str): Palabra clave objetivo.

    Returns:
        JSON: Sugerencia generada por la IA.
    """
    data = request.json or {}
    issue_type = data.get('issue')
    context_text = data.get('context', '') # El H1 actual, o el primer párrafo del texto
    target_kw = data.get('kw', '')

    prompt = ""

    if issue_type == 'meta_missing':
        prompt = f"Genera una Meta Description SEO optimizada (max 155 caracteres) para un texto que empieza así: '{context_text[:500]}...'. Keyword objetivo: '{target_kw}'."

    elif issue_type == 'title_length':
        prompt = f"Reescribe este Title Tag para que tenga menos de 60 caracteres pero mantenga el CTR y la keyword '{target_kw}': '{context_text}'"

    elif issue_type == 'h1_missing':
        prompt = f"Genera un H1 atractivo y SEO para este contenido: '{context_text[:300]}...'. Debe incluir: '{target_kw}'."

    elif issue_type == 'no_alt':
        prompt = f"Genera un texto ALT descriptivo y breve para una imagen en un artículo sobre '{target_kw}'. Contexto: '{context_text}'."

    else:
        return jsonify({"error": "Tipo de problema no soportado por la AI"}), 400

    suggestion = generate_with_gpt(prompt)

    return jsonify({
        "status": "success",
        "suggestion": suggestion,
        "type": issue_type
    })

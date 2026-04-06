from flask import Blueprint, request, jsonify
from apps.tools.llm_service import query_llm

enhance_bp = Blueprint('enhance_bp', __name__)

@enhance_bp.route('/api/enhance', methods=['POST'])
def enhance_content():
    """
    Endpoint para vitaminizar/mejorar contenido usando IA.

    Params (JSON):
        content (str): El contenido a procesar.
        prompt (str): Instrucción específica (opcional, default: "Mejora este contenido").
        provider (str): 'openai', 'anthropic', 'google' (default: 'openai').
        model (str): Modelo específico (opcional).

    Returns:
        JSON con el resultado procesado.
    """
    data = request.get_json(silent=True) or {}

    content = data.get('content')
    if not content:
        return jsonify({"error": "No se proporcionó contenido ('content')"}), 400

    prompt_instruction = data.get('prompt', 'Mejora y enriquece el siguiente contenido para SEO y legibilidad.')
    provider = data.get('provider', 'openai')
    model = data.get('model')

    # Construir el prompt final
    full_prompt = f"{prompt_instruction}\n\n---\nCONTENIDO:\n{content}\n---"

    # Llamar al servicio unificado
    result = query_llm(full_prompt, provider=provider, model=model)

    return jsonify({
        "status": "success",
        "provider": provider,
        "model": model or "default",
        "original_length": len(content),
        "result": result
    })

import os
import logging
from flask import session, has_request_context
from apps.tools.utils import sanitize_log_message
from apps.tools.ai_hub import execute_ai_task

# Configuración de Logging
logger = logging.getLogger(__name__)

# Intentamos importar las librerías necesarias
try:
    import openai
except ImportError:
    openai = None

try:
    import anthropic
except ImportError:
    anthropic = None

try:
    import google.generativeai as genai
except ImportError:
    genai = None

# Constantes de Modelos por defecto
DEFAULT_OPENAI_MODEL = "gpt-3.5-turbo"
DEFAULT_CLAUDE_MODEL = "claude-3-haiku-20240307"
DEFAULT_GEMINI_MODEL = "gemini-pro"

def query_llm(prompt, provider='openai', model=None, api_key=None):
    """
    Función unificada para consultar LLMs (OpenAI, Anthropic, Google).

    Args:
        prompt (str): La instrucción o contenido a procesar.
        provider (str): 'openai', 'anthropic', o 'google'/'gemini'.
        model (str): Nombre del modelo específico (opcional).
        api_key (str): API Key específica (opcional, busca en ENV si es None).

    Returns:
        str: La respuesta generada por la IA o un mensaje de error/simulación.
    """
    # --- LOGICA DE MODELOS IA (Override Global) ---
    if has_request_context():
        user_model = session.get('ai_model')
        if user_model and user_model != 'default':
            # Recuperamos la key de la sesión si existe
            api_key = session.get(f'ai_key_{user_model}')
            # Ejecutamos con el modelo seleccionado
            result = execute_ai_task(prompt, user_model, api_key)
            # Retornamos el texto completo (contenido + nota de privacidad)
            return result.get('full_text', result.get('content', ''))
    # -----------------------------------------------------

    provider = provider.lower()

    if provider == 'openai':
        return _query_openai(prompt, model, api_key)
    elif provider in ['anthropic', 'claude']:
        return _query_anthropic(prompt, model, api_key)
    elif provider in ['google', 'gemini']:
        return _query_google(prompt, model, api_key)
    else:
        return f"Error: Proveedor '{provider}' no soportado."

def _query_openai(prompt, model, api_key):
    """Lógica para OpenAI"""
    key = api_key or os.getenv("OPENAI_API_KEY")
    if not openai or not key:
        return _simulation_response("OpenAI", prompt)

    target_model = model or DEFAULT_OPENAI_MODEL
    try:
        client = openai.OpenAI(api_key=key)
        response = client.chat.completions.create(
            model=target_model,
            messages=[
                {"role": "system", "content": "Eres un asistente experto en análisis de contenido y SEO."},
                {"role": "user", "content": prompt}
            ]
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        logger.error(f"Error OpenAI: {sanitize_log_message(str(e))}")
        return "Error al conectar con OpenAI. Verifica tu API Key."

def _query_anthropic(prompt, model, api_key):
    """Lógica para Anthropic (Claude)"""
    key = api_key or os.getenv("ANTHROPIC_API_KEY")
    if not anthropic or not key:
        return _simulation_response("Anthropic/Claude", prompt)

    target_model = model or DEFAULT_CLAUDE_MODEL
    try:
        client = anthropic.Anthropic(api_key=key)
        message = client.messages.create(
            model=target_model,
            max_tokens=1024,
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        return message.content[0].text
    except Exception as e:
        logger.error(f"Error Anthropic: {sanitize_log_message(str(e))}")
        return "Error al conectar con Anthropic. Verifica tu API Key."

def _query_google(prompt, model, api_key):
    """Lógica para Google Gemini"""
    key = api_key or os.getenv("GOOGLE_API_KEY")
    if not genai or not key:
        return _simulation_response("Google Gemini", prompt)

    target_model = model or DEFAULT_GEMINI_MODEL
    try:
        genai.configure(api_key=key)
        model_instance = genai.GenerativeModel(target_model)
        response = model_instance.generate_content(prompt)
        return response.text
    except Exception as e:
        logger.error(f"Error Google Gemini: {sanitize_log_message(str(e))}")
        return "Error al conectar con Google Gemini. Verifica tu API Key."

def _simulation_response(provider, prompt):
    """Respuesta simulada cuando no hay API Key o librería"""
    logger.warning(f"Usando modo simulación para {provider}")
    return (
        f"[SIMULACIÓN {provider}] Vitaminización completada.\n"
        f"He analizado el prompt: '{prompt[:50]}...'\n"
        f"Resultados mejorados: El contenido ha sido enriquecido con mejores entidades y estructura (Dummy Response)."
    )

import requests
import logging
import json
import os
from flask import session, has_request_context
from apps.tools.utils import sanitize_log_message

logger = logging.getLogger(__name__)

# --- CONFIGURACIÓN DE MODELOS IA (Gratuitos y de Pago) ---
AI_MODELS = {
    # --- MODELOS GRATUITOS ---
    'deepseek-openrouter': {
        'id': 'deepseek-openrouter',
        'name': 'DeepSeek-V3 (OpenRouter)',
        'category': 'free',
        'specialty': 'Artículos largos, lógica compleja y código',
        'provider': 'OpenRouter',
        'anonymity': 'medium',
        'anonymity_label': '🛡️ Proxy (Medium)',
        'privacy_note': 'OpenRouter actúa como proxy ocultando tu IP al proveedor final, pero guarda logs de las peticiones para evitar abusos.',
        'requires_key': True,
        'endpoint': 'https://openrouter.ai/api/v1/chat/completions',
        'model_id': 'deepseek/deepseek-chat'
    },
    'llama-groq': {
        'id': 'llama-groq',
        'name': 'Llama-3.2-90b-vision (Groq)',
        'category': 'free',
        'specialty': 'Análisis visual y velocidad extrema',
        'provider': 'Groq',
        'anonymity': 'low',
        'anonymity_label': '🔑 Requiere Key (Low)',
        'privacy_note': 'Groq requiere registro. Tus datos pasan por sus servidores, aunque afirman no entrenar con datos de API.',
        'requires_key': True,
        'endpoint': 'https://api.groq.com/openai/v1/chat/completions',
        'model_id': 'llama-3.2-90b-vision-preview'
    },
    'pollinations': {
        'id': 'pollinations',
        'name': 'Pollinations.ai (Imágenes)',
        'category': 'free',
        'specialty': 'Generación de banners y miniaturas',
        'provider': 'Pollinations',
        'anonymity': 'high',
        'anonymity_label': '🕵️ Anónimo (High)',
        'privacy_note': 'No requiere API Key ni registro. No guarda rastro vinculado a una cuenta. Opción más privada.',
        'requires_key': False,
        'endpoint': 'https://image.pollinations.ai/prompt/'
    },
    'duckduckgo': {
        'id': 'duckduckgo',
        'name': 'DuckDuckGo AI',
        'category': 'free',
        'specialty': 'Consultas SEO rápidas y anónimas',
        'provider': 'DuckDuckGo',
        'anonymity': 'max',
        'anonymity_label': '🕵️ Máximo (Max)',
        'privacy_note': 'DuckDuckGo elimina las IPs y no guarda historial de conversación.',
        'requires_key': False
    },

    # --- MODELOS DE PAGO ---
    'gpt-4o': {
        'id': 'gpt-4o',
        'name': 'GPT-4o (OpenAI)',
        'category': 'paid',
        'specialty': 'Razonamiento avanzado y multimodalidad',
        'provider': 'OpenAI',
        'anonymity': 'low',
        'anonymity_label': '🔑 Enterprise (Low)',
        'privacy_note': 'Requiere API Key de pago. Tus datos se rigen por la política Enterprise de OpenAI (no entrenamiento por defecto).',
        'requires_key': True,
        'model_id': 'gpt-4o'
    },
    'gpt-4o-mini': {
        'id': 'gpt-4o-mini',
        'name': 'GPT-4o Mini (OpenAI)',
        'category': 'paid',
        'specialty': 'Rapidez y eficiencia para tareas simples',
        'provider': 'OpenAI',
        'anonymity': 'low',
        'anonymity_label': '🔑 Enterprise (Low)',
        'privacy_note': 'Requiere API Key de pago. Versión ligera y económica de GPT-4o.',
        'requires_key': True,
        'model_id': 'gpt-4o-mini'
    },
    'claude-3-5-sonnet': {
        'id': 'claude-3-5-sonnet',
        'name': 'Claude 3.5 Sonnet (Anthropic)',
        'category': 'paid',
        'specialty': 'Escritura natural, matices y código',
        'provider': 'Anthropic',
        'anonymity': 'low',
        'anonymity_label': '🔑 Commercial (Low)',
        'privacy_note': 'Requiere API Key de pago. Anthropic tiene políticas estrictas de seguridad y alineación.',
        'requires_key': True,
        'model_id': 'claude-3-5-sonnet-20240620'
    },
    'gemini-1-5-flash': {
        'id': 'gemini-1-5-flash',
        'name': 'Gemini 1.5 Flash (Google)',
        'category': 'paid',
        'specialty': 'Contexto largo y velocidad extrema',
        'provider': 'Google',
        'anonymity': 'low',
        'anonymity_label': '🔑 Cloud (Low)',
        'privacy_note': 'Requiere API Key de Google AI Studio / Vertex. Alta velocidad y ventana de contexto masiva.',
        'requires_key': True,
        'model_id': 'gemini-1.5-flash'
    }
}

def execute_ai_task(prompt, model_id, api_key=None):
    """
    Ejecuta una tarea con el modelo seleccionado (gratuito o de pago).
    Retorna un diccionario con 'content' y 'privacy_note'.
    """
    model_config = AI_MODELS.get(model_id)
    if not model_config:
        return {'content': f"Error: Modelo '{model_id}' no encontrado.", 'privacy_note': ''}

    privacy_note = f"\n\n--- 🔒 NOTA DE PRIVACIDAD ({model_config['name']}) ---\n{model_config['privacy_note']}"

    try:
        content = ""
        # --- LÓGICA MODELOS GRATUITOS ---
        if model_id == 'deepseek-openrouter':
            content = _query_openrouter(prompt, api_key, model_config)
        elif model_id == 'llama-groq':
            content = _query_groq(prompt, api_key, model_config)
        elif model_id == 'pollinations':
            content = _query_pollinations_text(prompt)
        elif model_id == 'duckduckgo':
            content = _query_duckduckgo(prompt)

        # --- LÓGICA MODELOS DE PAGO ---
        elif model_config['provider'] == 'OpenAI':
            content = _query_openai_direct(prompt, api_key, model_config['model_id'])
        elif model_config['provider'] == 'Anthropic':
            content = _query_anthropic_direct(prompt, api_key, model_config['model_id'])
        elif model_config['provider'] == 'Google':
            content = _query_google_direct(prompt, api_key, model_config['model_id'])

        else:
            content = "Modelo no implementado o proveedor desconocido."

        return {
            'content': content,
            'privacy_note': privacy_note,
            'full_text': f"{content}\n{privacy_note}"
        }
    except Exception as e:
        logger.error(f"Error en AI Hub ({model_id}): {sanitize_log_message(str(e))}")
        return {
            'content': f"Error al ejecutar con {model_config['name']}: {str(e)}",
            'privacy_note': privacy_note,
            'full_text': f"Error: {str(e)}\n{privacy_note}"
        }

def generate_ai_image(prompt, model_id='pollinations'):
    """Genera una URL de imagen usando modelos compatibles."""
    if model_id == 'pollinations':
        import urllib.parse
        encoded_prompt = urllib.parse.quote(prompt)
        url = f"https://image.pollinations.ai/prompt/{encoded_prompt}"
        return url
    return None

# --- IMPLEMENTACIONES ESPECÍFICAS ---

def _query_openrouter(prompt, api_key, config):
    if not api_key:
        return "Error: Se requiere API Key de OpenRouter para este modelo."

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://mediaflow.app",
        "X-Title": "MediaFlow SEO Suite"
    }
    data = {
        "model": "deepseek/deepseek-chat",
        "messages": [{"role": "user", "content": prompt}]
    }

    try:
        resp = requests.post(config['endpoint'], headers=headers, json=data, timeout=30)
        resp.raise_for_status()
        result = resp.json()
        return result['choices'][0]['message']['content']
    except Exception as e:
        logger.error(f"OpenRouter Error: {e}")
        return f"Error OpenRouter: {str(e)}"

def _query_groq(prompt, api_key, config):
    if not api_key:
        return "Error: Se requiere API Key de Groq."

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    data = {
        "model": config['model_id'],
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.7
    }

    try:
        resp = requests.post(config['endpoint'], headers=headers, json=data, timeout=30)
        resp.raise_for_status()
        result = resp.json()
        return result['choices'][0]['message']['content']
    except Exception as e:
        logger.error(f"Groq Error: {e}")
        return f"Error Groq: {str(e)}"

def _query_pollinations_text(prompt):
    import urllib.parse
    encoded_prompt = urllib.parse.quote(prompt)
    url = f"https://image.pollinations.ai/prompt/{encoded_prompt}"
    return f"![Imagen Generada por Pollinations]({url})\n\n(Nota: Has seleccionado Pollinations. Se ha generado una imagen basada en tu prompt: '{prompt}')"

def _query_duckduckgo(prompt):
    try:
        from duckduckgo_search import DDGS
        ddgs = DDGS()
        try:
            results = ddgs.chat(prompt, model='gpt-3.5')
            return results
        except AttributeError:
            results = ddgs.text(prompt, max_results=3)
            summary = "\n".join([f"- {r['title']}: {r['body']}" for r in results])
            return f"Resumen de búsqueda (Chat no disponible en esta versión):\n{summary}"
    except ImportError:
        return "Error: Librería duckduckgo-search no instalada."
    except Exception as e:
        logger.error(f"DDG Error: {e}")
        return f"Error DuckDuckGo: {str(e)}"

# --- CLIENTES OFICIALES (PAID) ---

def _query_openai_direct(prompt, api_key, model_id):
    """Cliente directo de OpenAI usando librería oficial o requests si falla."""
    final_key = api_key
    if not final_key and has_request_context():
        final_key = session.get('openai_key')
    if not final_key:
        final_key = os.getenv("OPENAI_API_KEY")

    if not final_key:
        return "Error: No se encontró API Key de OpenAI (ni en sesión ni en entorno)."

    try:
        import openai
        client = openai.OpenAI(api_key=final_key)
        response = client.chat.completions.create(
            model=model_id,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.choices[0].message.content.strip()
    except ImportError:
        # Fallback a requests si no está instalada la lib
        headers = {"Authorization": f"Bearer {final_key}", "Content-Type": "application/json"}
        data = {"model": model_id, "messages": [{"role": "user", "content": prompt}]}
        resp = requests.post("https://api.openai.com/v1/chat/completions", headers=headers, json=data, timeout=60)
        resp.raise_for_status()
        return resp.json()['choices'][0]['message']['content']
    except Exception as e:
        return f"Error OpenAI Direct: {str(e)}"

def _query_anthropic_direct(prompt, api_key, model_id):
    final_key = api_key
    if not final_key and has_request_context():
        final_key = session.get('anthropic_key')
    if not final_key:
        final_key = os.getenv("ANTHROPIC_API_KEY")

    if not final_key:
        return "Error: No se encontró API Key de Anthropic."

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=final_key)
        message = client.messages.create(
            model=model_id,
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}]
        )
        return message.content[0].text
    except Exception as e:
        return f"Error Anthropic Direct: {str(e)}"

def _query_google_direct(prompt, api_key, model_id):
    final_key = api_key
    if not final_key and has_request_context():
        final_key = session.get('google_key')
    if not final_key:
        final_key = os.getenv("GOOGLE_API_KEY")

    if not final_key:
        return "Error: No se encontró API Key de Google."

    try:
        import google.generativeai as genai
        genai.configure(api_key=final_key)
        model = genai.GenerativeModel(model_id)
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        return f"Error Google Direct: {str(e)}"

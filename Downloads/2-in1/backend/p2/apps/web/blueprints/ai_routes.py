import json
import os
from flask import Blueprint, request, jsonify, session, render_template, has_request_context
from apps.tools.ai_hub import AI_MODELS, execute_ai_task, generate_ai_image
from apps.core.database import (
    get_user_settings,
    upsert_user_settings,
    upsert_ai_visibility_config,
    get_ai_visibility_history,
    get_ai_visibility_config,
    insert_ai_visibility_run,
    upsert_ai_visibility_schedule,
    get_ai_visibility_schedule,
)
import logging

logger = logging.getLogger(__name__)

ai_bp = Blueprint('ai_tools', __name__)


def _build_visibility_prompt(payload):
    brand = payload.get('brand')
    competitors = payload.get('competitors', [])
    prompt_template = payload.get('promptTemplate')
    sources = payload.get('sources', [])

    return (
        f"{prompt_template}\n\n"
        "Devuelve JSON estricto con este formato:\n"
        "{\n"
        '  "mentions": number,\n'
        '  "shareOfVoice": number,\n'
        '  "sentiment": number,\n'
        '  "competitorAppearances": { "competitor": number },\n'
        '  "rawEvidence": [\n'
        '    {"source": "string", "summary": "string", "score": number}\n'
        "  ]\n"
        "}\n\n"
        f"clientId: {payload.get('clientId')}\n"
        f"brand: {brand}\n"
        f"competitors: {json.dumps(competitors, ensure_ascii=False)}\n"
        f"sources: {json.dumps(sources, ensure_ascii=False)}\n"
    )


def _extract_json_content(raw_text):
    if not isinstance(raw_text, str):
        return {}
    cleaned = raw_text.strip().replace('```json', '').replace('```', '').strip()
    try:
        return json.loads(cleaned)
    except Exception:
        start = cleaned.find('{')
        end = cleaned.rfind('}')
        if start >= 0 and end > start:
            try:
                return json.loads(cleaned[start:end + 1])
            except Exception:
                return {}
        return {}


def _run_visibility_with_priority(prompt, provider_priority, credentials=None):
    from apps.tools.llm_service import _query_google, _query_openai

    priority = provider_priority or ['gemini', 'openai']
    credentials = credentials or {}
    last_error = None

    for provider in priority:
        provider_id = str(provider).strip().lower()
        try:
            if provider_id == 'gemini':
                gemini_key = credentials.get('google_key')
                if not gemini_key and has_request_context():
                    gemini_key = session.get('google_key')
                gemini_key = gemini_key or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
                response_text = _query_google(prompt, model='gemini-2.0-flash', api_key=gemini_key)
            elif provider_id in ('openai', 'chatgpt'):
                openai_key = credentials.get('openai_key')
                if not openai_key and has_request_context():
                    openai_key = session.get('openai_key')
                openai_key = openai_key or os.getenv("OPENAI_API_KEY")
                response_text = _query_openai(prompt, model='gpt-4o-mini', api_key=openai_key)
            else:
                continue

            if not response_text or str(response_text).lower().startswith('error al conectar'):
                raise RuntimeError(response_text or f'No response from {provider_id}')

            parsed = _extract_json_content(response_text)
            if parsed:
                return provider_id, parsed
            raise RuntimeError(f'Invalid JSON response from {provider_id}')
        except Exception as exc:
            logger.warning("Visibility provider failed: %s (%s)", provider_id, exc)
            last_error = str(exc)

    raise RuntimeError(last_error or 'No AI provider available')


def execute_visibility_analysis(payload, credentials=None):
    prompt = _build_visibility_prompt(payload)
    provider_used, ai_result = _run_visibility_with_priority(
        prompt, payload.get('providerPriority'), credentials=credentials
    )
    return {
        'mentions': float(ai_result.get('mentions', 0)),
        'shareOfVoice': float(ai_result.get('shareOfVoice', 0)),
        'sentiment': float(ai_result.get('sentiment', 0)),
        'competitorAppearances': ai_result.get('competitorAppearances', {}),
        'rawEvidence': ai_result.get('rawEvidence', []),
        'providerUsed': provider_used,
    }

@ai_bp.route('/settings', methods=['GET'])
def settings_page():
    """Renderiza el panel centralizado de Configuración & IA."""
    # 1. Recuperar settings de DB (Usuario default por ahora)
    user_settings = get_user_settings('default')

    # 2. Preparar lista de modelos para el frontend
    models_list = []
    for mid, m in AI_MODELS.items():
        models_list.append({
            'id': m['id'],
            'name': m['name'],
            'specialty': m['specialty'],
            'provider': m['provider'],
            'anonymity': m['anonymity'],
            'anonymity_label': m['anonymity_label'],
            'privacy_note': m['privacy_note'],
            'requires_key': m['requires_key'],
            'category': m.get('category', 'free')
        })

    # 3. Enmascarar claves para seguridad en frontend
    # Solo mostramos los últimos 4 chars si existe la clave
    masked_settings = user_settings.copy()
    sensitive_keys = ['openai_key', 'anthropic_key', 'dataforseo_password', 'serpapi_key']

    for k in sensitive_keys:
        val = masked_settings.get(k)
        if val and len(val) > 4:
            masked_settings[k] = 'sk-****' + val[-4:]
        elif val:
            masked_settings[k] = '****'

    # Fallbacks para valores no seteados
    if not masked_settings.get('default_model'):
        masked_settings['default_model'] = 'default'

    return render_template('settings.html',
                           models=models_list,
                           settings=masked_settings)

@ai_bp.route('/api/settings/update', methods=['POST'])
def update_settings_api():
    """Actualiza la configuración en DB y sincroniza la Sesión."""
    data = request.get_json(silent=True) or {}

    try:
        user_id = 'default'
        current_settings = get_user_settings(user_id)

        # 1. Filtrar claves vacías (para no borrar claves existentes si el usuario envía placeholder)
        # Si el usuario no tocó el input, el frontend podría no enviarlo o enviar la máscara.
        # Asumiremos que el frontend envía todo. Si el valor contiene '****', lo ignoramos.

        updates = {}
        valid_fields = [
            'default_model', 'privacy_mode', 'openai_key', 'anthropic_key',
            'dataforseo_login', 'dataforseo_password', 'dataforseo_detail', 'dataforseo_execution_mode', 'serpapi_key',
            'serp_provider', 'google_cse_key', 'google_cse_cx', 'scraping_cookie',
            'memory_limit', 'system_prompt'
        ]

        for field in valid_fields:
            val = data.get(field)

            # Lógica de ignorar máscaras
            if val and '****' in str(val):
                continue # No actualizamos, mantenemos el valor de DB

            # Si viene vacío, ¿borramos o mantenemos?
            # UX estándar: Si está vacío, se borra. Si quieres mantener, no lo tocas.
            # Pero cuidado con los placeholders. El frontend debe manejar esto.
            # Aquí asumimos: Si valor es explícito (y no máscara), se guarda.
            if val is not None:
                updates[field] = val

        # 2. Guardar en DB
        if updates:
            upsert_user_settings(user_id, updates)

        # 3. Sincronizar Sesión (Para que las herramientas funcionen ya)
        # Fusionamos lo nuevo con lo que ya había en settings para tener el estado completo
        new_state = {**current_settings, **updates}

        # Mapear a las claves de sesión que usa el sistema legacy
        session['ai_model'] = new_state.get('default_model', 'default')
        session['ai_high_privacy'] = bool(new_state.get('privacy_mode', 0))
        session['openai_key'] = new_state.get('openai_key')
        session['anthropic_key'] = new_state.get('anthropic_key')
        session['dataforseo_login'] = new_state.get('dataforseo_login')
        session['dataforseo_password'] = new_state.get('dataforseo_password')
        session['dataforseo_pass'] = new_state.get('dataforseo_password')
        session['dataforseo_detail'] = new_state.get('dataforseo_detail', 'regular')
        session['dataforseo_execution_mode'] = new_state.get('dataforseo_execution_mode', 'standard')
        session['serpapi_key'] = new_state.get('serpapi_key')
        session['serp_provider'] = new_state.get('serp_provider', 'dataforseo')
        session['google_cse_key'] = new_state.get('google_cse_key')
        session['google_cse_cx'] = new_state.get('google_cse_cx')
        session['scraping_cookie'] = new_state.get('scraping_cookie')
        session['memory_context_window'] = 'standard' # Simplificación, o mapear memory_limit

        # Mapeo extra para memory_limit -> memory_context_window si queremos
        limit = int(new_state.get('memory_limit', 4096))
        if limit < 8000: session['memory_context_window'] = 'short'
        elif limit > 32000: session['memory_context_window'] = 'long'
        else: session['memory_context_window'] = 'standard'

        return jsonify({'status': 'ok', 'message': 'Configuración guardada y aplicada.'})

    except Exception as e:
        logger.error(f"Error updating settings: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


@ai_bp.route('/ai/dashboard', methods=['GET'])
def dashboard():
    """Renderiza la página de configuración de modelos IA."""
    models_list = []
    for mid, m in AI_MODELS.items():
        models_list.append({
            'id': m['id'],
            'name': m['name'],
            'specialty': m['specialty'],
            'provider': m['provider'],
            'anonymity': m['anonymity'],
            'anonymity_label': m['anonymity_label'],
            'privacy_note': m['privacy_note'],
            'requires_key': m['requires_key'],
            'category': m.get('category', 'free')
        })

    current_model = session.get('ai_model', 'default')
    high_privacy = session.get('ai_high_privacy', False)

    # Global Configs
    config = {
        'openai_key': session.get('openai_key', ''),
        'anthropic_key': session.get('anthropic_key', ''),
        'google_key': session.get('google_key', ''),
        'dataforseo_login': session.get('dataforseo_login', ''),
        'dataforseo_password': session.get('dataforseo_password', session.get('dataforseo_pass', '')),
        'dataforseo_detail': session.get('dataforseo_detail', 'regular'),
        'dataforseo_execution_mode': session.get('dataforseo_execution_mode', 'standard'),
        'google_cse_key': session.get('google_cse_key', ''),
        'google_cse_cx': session.get('google_cse_cx', ''),
        'scraping_cookie': session.get('scraping_cookie', ''),
        'memory_context_window': session.get('memory_context_window', 'standard'),
        'serp_provider': session.get('serp_provider', 'dataforseo'),
        'serpapi_key': session.get('serpapi_key', '')
    }

    return render_template('ai/dashboard.html',
                           models=models_list,
                           current_model=current_model,
                           high_privacy=high_privacy,
                           config=config)

@ai_bp.route('/ai/config', methods=['GET'])
def get_config():
    """Retorna los modelos disponibles y la configuración actual del usuario."""
    models_list = []
    for mid, m in AI_MODELS.items():
        models_list.append({
            'id': m['id'],
            'name': m['name'],
            'specialty': m['specialty'],
            'provider': m['provider'],
            'anonymity': m['anonymity'],
            'anonymity_label': m['anonymity_label'],
            'privacy_note': m['privacy_note'],
            'requires_key': m['requires_key'],
            'category': m.get('category', 'free')
        })

    current_model = session.get('ai_model', 'default')
    high_privacy = session.get('ai_high_privacy', False)

    return jsonify({
        'models': models_list,
        'current_model': current_model,
        'high_privacy': high_privacy
    })

@ai_bp.route('/ai/preference', methods=['POST'])
def set_preference():
    """Guarda la preferencia de modelo, claves API globales y memoria en la sesión."""
    data = request.get_json(silent=True) or {}
    model_id = data.get('model_id')

    # Update AI Model if provided
    if model_id:
        if model_id != 'default' and model_id not in AI_MODELS:
            return jsonify({'error': 'Modelo no válido'}), 400
        session['ai_model'] = model_id

        # Specific key for this model (legacy support)
        api_key = data.get('api_key')
        if api_key:
            session[f'ai_key_{model_id}'] = api_key

    # Global Settings
    if 'high_privacy' in data:
        session['ai_high_privacy'] = data.get('high_privacy')

    # Global Keys
    global_keys = [
        'openai_key', 'anthropic_key', 'google_key',
        'dataforseo_login', 'dataforseo_password', 'dataforseo_pass',
        'dataforseo_detail', 'dataforseo_execution_mode',
        'google_cse_key', 'google_cse_cx',
        'scraping_cookie', 'memory_context_window',
        'serp_provider', 'serpapi_key'
    ]

    for key in global_keys:
        if key in data:
            session[key] = data[key]

    return jsonify({'status': 'ok', 'message': 'Configuración actualizada correctamente'})


@ai_bp.route('/api/ai/visibility/config/<client_id>', methods=['POST'])
def upsert_visibility_config(client_id):
    payload = request.get_json(silent=True) or {}
    required = ['clientId', 'brand', 'competitors', 'promptTemplate', 'sources', 'providerPriority']
    missing = [field for field in required if field not in payload]
    if missing:
        return jsonify({'error': f'Faltan campos requeridos: {", ".join(missing)}'}), 400

    if str(payload.get('clientId')) != str(client_id):
        return jsonify({'error': 'clientId del payload debe coincidir con el parámetro de ruta'}), 400

    config = upsert_ai_visibility_config(client_id, payload)
    return jsonify({
        'status': 'ok',
        'config': {
            'clientId': config.get('client_id'),
            'brand': config.get('brand'),
            'competitors': config.get('competitors', []),
            'promptTemplate': config.get('prompt_template', ''),
            'sources': config.get('sources', []),
            'providerPriority': config.get('provider_priority', []),
            'updatedAt': config.get('updated_at'),
        }
    })


@ai_bp.route('/api/ai/visibility/history/<client_id>', methods=['GET'])
def visibility_history(client_id):
    history = get_ai_visibility_history(client_id)
    return jsonify({
        'clientId': str(client_id),
        'runs': [
            {
                'id': row.get('id'),
                'clientId': row.get('client_id'),
                'version': row.get('run_version', 1),
                'runTrigger': row.get('run_trigger', 'manual'),
                'mentions': row.get('mentions', 0),
                'shareOfVoice': row.get('share_of_voice', 0),
                'sentiment': row.get('sentiment', 0),
                'competitorAppearances': row.get('competitor_appearances', {}),
                'rawEvidence': row.get('raw_evidence', []),
                'providerUsed': row.get('provider_used'),
                'createdAt': row.get('created_at'),
            }
            for row in history
        ],
    })


@ai_bp.route('/api/ai/visibility/run', methods=['POST'])
def run_visibility_analysis():
    payload = request.get_json(silent=True) or {}
    required = ['clientId', 'brand', 'competitors', 'promptTemplate', 'sources', 'providerPriority']
    missing = [field for field in required if field not in payload]
    if missing:
        return jsonify({'error': f'Faltan campos requeridos: {", ".join(missing)}'}), 400

    if not payload.get('promptTemplate'):
        saved = get_ai_visibility_config(str(payload.get('clientId')))
        if saved:
            payload['promptTemplate'] = saved.get('prompt_template', '')

    try:
        response = execute_visibility_analysis(payload)
    except Exception as exc:
        return jsonify({'error': f'No fue posible ejecutar el análisis de visibilidad: {exc}'}), 502

    insert_ai_visibility_run(
        str(payload.get('clientId')),
        {
            'runTrigger': 'manual',
            'requestPayload': payload,
            'mentions': response['mentions'],
            'shareOfVoice': response['shareOfVoice'],
            'sentiment': response['sentiment'],
            'competitorAppearances': response['competitorAppearances'],
            'rawEvidence': response['rawEvidence'],
            'providerUsed': response['providerUsed'],
        }
    )

    return jsonify({'clientId': str(payload.get('clientId')), **response})


@ai_bp.route('/api/ai/visibility/schedule/<client_id>', methods=['GET'])
def get_visibility_schedule(client_id):
    schedule = get_ai_visibility_schedule(client_id)
    if not schedule:
        schedule = {
            'client_id': str(client_id),
            'frequency': 'daily',
            'timezone': 'UTC',
            'run_hour': 9,
            'run_minute': 0,
            'status': 'paused',
        }
    return jsonify({
        'clientId': str(client_id),
        'schedule': {
            'frequency': schedule.get('frequency', 'daily'),
            'timezone': schedule.get('timezone', 'UTC'),
            'runHour': schedule.get('run_hour', 9),
            'runMinute': schedule.get('run_minute', 0),
            'status': schedule.get('status', 'paused'),
            'lastRunAt': schedule.get('last_run_at'),
            'updatedAt': schedule.get('updated_at'),
        }
    })


@ai_bp.route('/api/ai/visibility/schedule/<client_id>', methods=['POST'])
def upsert_visibility_schedule(client_id):
    payload = request.get_json(silent=True) or {}
    schedule = upsert_ai_visibility_schedule(client_id, payload)
    return jsonify({
        'status': 'ok',
        'clientId': str(client_id),
        'schedule': {
            'frequency': schedule.get('frequency', 'daily'),
            'timezone': schedule.get('timezone', 'UTC'),
            'runHour': schedule.get('run_hour', 9),
            'runMinute': schedule.get('run_minute', 0),
            'status': schedule.get('status', 'paused'),
            'lastRunAt': schedule.get('last_run_at'),
            'updatedAt': schedule.get('updated_at'),
        }
    })


@ai_bp.route('/api/ai/visibility/schedule/<client_id>/pause', methods=['POST'])
def pause_visibility_schedule(client_id):
    schedule = upsert_ai_visibility_schedule(client_id, {'status': 'paused'})
    return jsonify({
        'status': 'ok',
        'clientId': str(client_id),
        'schedule': {
            'frequency': schedule.get('frequency', 'daily'),
            'timezone': schedule.get('timezone', 'UTC'),
            'runHour': schedule.get('run_hour', 9),
            'runMinute': schedule.get('run_minute', 0),
            'status': schedule.get('status', 'paused'),
            'lastRunAt': schedule.get('last_run_at'),
            'updatedAt': schedule.get('updated_at'),
        }
    })


@ai_bp.route('/api/ai/visibility/schedule/<client_id>/resume', methods=['POST'])
def resume_visibility_schedule(client_id):
    schedule = upsert_ai_visibility_schedule(client_id, {'status': 'active'})
    return jsonify({
        'status': 'ok',
        'clientId': str(client_id),
        'schedule': {
            'frequency': schedule.get('frequency', 'daily'),
            'timezone': schedule.get('timezone', 'UTC'),
            'runHour': schedule.get('run_hour', 9),
            'runMinute': schedule.get('run_minute', 0),
            'status': schedule.get('status', 'paused'),
            'lastRunAt': schedule.get('last_run_at'),
            'updatedAt': schedule.get('updated_at'),
        }
    })

@ai_bp.route('/ai/seo-analysis', methods=['POST'])
def seo_analysis_endpoint():
    """Genera un análisis SEO utilizando Google Gemini desde el backend."""
    data = request.get_json(silent=True) or {}
    content = data.get('content')
    analysis_type = data.get('type')
    vertical = data.get('vertical')

    if not content or not analysis_type:
        return jsonify({'error': 'Faltan parámetros requeridos'}), 400

    system_instruction = (
        'CRITICAL INSTRUCTION: You are an SEO Expert Tool. Do NOT invent, simulate, or hallucinate data, '
        'metrics, traffic numbers, or statistics. If the user input does not contain enough information '
        'to perform a specific analysis (e.g. they provide a URL but you cannot crawl it), explicitly '
        'state what information is missing and provide theoretical advice based ONLY on the visible text '
        'provided. Base your analysis STRICTLY on the provided input text and general SEO best practices.'
    )

    prompt = ""
    if analysis_type == 'headline':
        prompt = f'{system_instruction}\n    Actúa como un Experto SEO. Analiza el siguiente texto y proporciona 3 variaciones optimizadas de H1 y una Meta Description (máx 155 caracteres) optimizada para CTR. Responde en Español.\n    \n    Texto: "{content}"'
    elif analysis_type == 'audit':
        prompt = f'{system_instruction}\n    Actúa como Auditor SEO Técnico. Proporciona una lista de comprobaciones basada en el input: "{content}". Si el input es una URL, menciona claramente que NO puedes rastrear la web en tiempo real pero da recomendaciones generales basadas en la estructura visible de la URL o el tema inferido. Responde en Español.'
    elif analysis_type == 'schema':
        prompt = f'{system_instruction}\n    Actúa como Desarrollador SEO Técnico. Genera un marcado Schema \'NewsArticle\' JSON-LD válido para: "{content}". Usa marcadores genéricos (ej: "URL_AQUI", "FECHA_AQUI") para datos que no estén explícitamente en el texto. NO inventes autores o fechas si no se dan. Muestra SOLO el código JSON.'
    elif analysis_type == 'calendar':
        prompt = f'{system_instruction}\n    Actúa como Redactor Jefe. Crea un calendario de contenidos de 5 días enfocado en el tema: "{content}". Sugiere ángulos \'Breaking News\' y \'Evergreen\'. Responde en Español.'
    elif analysis_type == 'competitor':
        prompt = f'{system_instruction}\n    Actúa como Estratega SEO. Analiza la estrategia de contenido típica para un sitio del tipo: "{content}". Identifica oportunidades teóricas de "Océano Azul". NO inventes competidores ni métricas de tráfico. Responde en Español.'
    elif analysis_type == 'tone':
        prompt = f'{system_instruction}\n    Actúa como Editor Senior. Analiza el tono de voz del texto. Da una puntuación del 1-10 en "Objetividad" basada SOLO en el texto.\n    Texto: "{content}"'
    elif analysis_type == 'roadmap':
        v = vertical or 'media'
        role = 'Estratega SEO General'
        focus = 'Visibilidad General'

        if v == 'media':
            role = 'Director SEO de Medio de Comunicación'
            focus = 'Google Discover, Top Stories, Velocidad'
        elif v == 'ecom':
            role = 'Head of SEO para E-commerce'
            focus = 'Fichas de Producto, Categorías, Crawl Budget'
        elif v == 'local':
            role = 'Especialista SEO Local'
            focus = 'Google Business Profile, Citaciones, Reseñas'
        elif v == 'national':
            role = 'Consultor SEO Nacional'
            focus = 'Arquitectura Web, Contenidos, Autoridad de Marca'
        elif v == 'international':
            role = 'Estratega SEO Internacional'
            focus = 'Hreflang, Localización, Dominios Globales'

        prompt = f'{system_instruction}\n    Actúa como {role}. Crea un Roadmap Estratégico de 6 meses para: "{content}".\n    Enfoque: {focus}.\n    Estructura (Markdown):\n    1. Diagnóstico Inicial (Teórico basado en input)\n    2. Fases (Mes 1-6)\n    3. KPIs Recomendados (Genéricos para el vertical)\n\n    Responde en Español.'
    else:
        return jsonify({'error': 'Tipo de análisis no válido'}), 400

    from apps.tools.llm_service import _query_google
    import os
    # Intentar obtener API Key de varios lugares para retrocompatibilidad
    api_key = session.get('google_key') or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    result = _query_google(prompt, model='gemini-2.0-flash', api_key=api_key)
    return jsonify({'result': result})

@ai_bp.route('/ai/headline-challenge', methods=['POST'])
def headline_challenge_endpoint():
    """Evalúa un titular para SEO y CTR usando Google Gemini desde el backend."""
    data = request.get_json(silent=True) or {}
    headline = data.get('headline')
    keywords = data.get('keywords')

    if not headline or not keywords:
        return jsonify({'error': 'Faltan parámetros requeridos'}), 400

    prompt = (
        f'Puntúa este titular de última hora en una escala de 0-100 por impacto SEO y CTR.\n'
        f'  Keywords Objetivo: "{keywords}"\n'
        f'  Titular: "{headline}"\n  \n'
        f'  Formato de salida:\n'
        f'  PUNTUACION: [número]\n'
        f'  FEEDBACK: [Una frase de crítica en Español]\n'
        f'  MEJOR_VERSION: [Una variación mejorada en Español]\n  \n'
        f'  Sé estricto pero justo. Puntuaciones altas requieren match exacto de keyword y gancho emocional.'
    )

    from apps.tools.llm_service import _query_google
    import os
    api_key = session.get('google_key') or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    result = _query_google(prompt, model='gemini-2.0-flash', api_key=api_key)
    return jsonify({'result': result})

@ai_bp.route('/ai/generate', methods=['POST'])
def generate_endpoint():
    """Endpoint directo para ejecutar tareas con modelos gratuitos."""
    data = request.get_json(silent=True) or {}
    prompt = data.get('prompt')
    model_id = data.get('model_id') or session.get('ai_model')

    if not prompt:
        return jsonify({'error': 'Prompt requerido'}), 400

    if not model_id or model_id == 'default':
        return jsonify({'error': 'Ningún modelo gratuito seleccionado.'}), 400

    # Recuperar clave de sesión si es necesaria
    api_key = session.get(f'ai_key_{model_id}')

    # Ejecutar
    result = execute_ai_task(prompt, model_id, api_key)
    return jsonify(result)

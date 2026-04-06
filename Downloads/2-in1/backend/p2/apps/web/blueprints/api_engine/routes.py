import json
import os
from flask import jsonify, request, current_app
from datetime import datetime
from apps.tools.utils import safe_get_json, clean_url, is_safe_url
from apps.core.database import get_user_settings
from . import api_engine_bp
from .seo_checklist_orchestrator import run_orchestrated_checklist

ALLOWED_CHECKLIST_AI_DECISIONS = {"si_ia", "error_claro_ia", "no_decidir"}
CHECKLIST_AI_SYSTEM_PROMPT = (
    "Devuelve SOLO JSON válido (sin markdown) con {\"results\":[...]}. "
    "Cada item: key (string), decision (si_ia|error_claro_ia|no_decidir), "
    "notes (string <=180), error (string opcional). "
    "No inventes checks ni campos."
)


def _extract_first_json_object(raw_text):
    text = (raw_text or "").strip()
    if not text:
        return ""
    if text.startswith("```"):
        text = text.replace("```json", "").replace("```", "").strip()

    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end < start:
        return ""
    return text[start : end + 1]


def _parse_checklist_ai_response(raw_text):
    payload_text = _extract_first_json_object(raw_text)
    if not payload_text:
        raise ValueError("La IA devolvió una respuesta vacía o sin JSON.")

    parsed = json.loads(payload_text)
    if not isinstance(parsed, dict):
        raise ValueError("La IA devolvió un JSON inválido.")

    raw_results = parsed.get("results")
    if not isinstance(raw_results, list):
        raise ValueError("La IA no devolvió una lista 'results' válida.")

    results = []
    for idx, item in enumerate(raw_results):
        if not isinstance(item, dict):
            raise ValueError(f"El item {idx} no es un objeto JSON.")

        key = str(item.get("key", "")).strip()
        decision = str(item.get("decision", "")).strip().lower()
        notes = str(item.get("notes", "")).strip()
        error = str(item.get("error", "")).strip()

        if not key:
            raise ValueError(f"El item {idx} no incluye un 'key' válido.")
        if decision not in ALLOWED_CHECKLIST_AI_DECISIONS:
            raise ValueError(f"El item {idx} incluye una decisión no permitida.")
        if len(notes) > 180:
            notes = notes[:180].rstrip()

        normalized_item = {"key": key, "decision": decision, "notes": notes}
        if error:
            normalized_item["error"] = error[:180].rstrip()
        results.append(normalized_item)

    global_errors = parsed.get("globalErrors", [])
    if not isinstance(global_errors, list):
        global_errors = []
    global_errors = [str(err).strip() for err in global_errors if str(err).strip()]

    return {"results": results, "globalErrors": global_errors}


def _run_checklist_ai_evaluation(provider, api_key, model, prompt):
    provider_id = (provider or "openai").strip().lower()
    model_id = (model or "").strip()

    if provider_id == "openai":
        from openai import OpenAI

        client = OpenAI(api_key=api_key)
        completion = client.chat.completions.create(
            model=model_id or "gpt-4o-mini",
            temperature=0.1,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": CHECKLIST_AI_SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
        )
        return (completion.choices[0].message.content or "").strip()

    if provider_id == "gemini":
        import google.generativeai as genai

        genai.configure(api_key=api_key)
        model_instance = genai.GenerativeModel(model_id or "gemini-1.5-pro")
        response = model_instance.generate_content(
            [
                {"role": "user", "parts": [CHECKLIST_AI_SYSTEM_PROMPT]},
                {"role": "user", "parts": [prompt]},
            ]
        )
        return (getattr(response, "text", "") or "").strip()

    if provider_id == "mistral":
        from mistralai import Mistral

        client = Mistral(api_key=api_key)
        response = client.chat.complete(
            model=model_id or "mistral-large-latest",
            temperature=0.1,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": CHECKLIST_AI_SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
        )
        message = response.choices[0].message
        return (message.content if isinstance(message.content, str) else "").strip()

    raise ValueError("Proveedor IA no soportado. Usa: openai, gemini o mistral.")


@api_engine_bp.route('/api/analyze', methods=['POST'])
def analyze():
    data = safe_get_json()
    url = clean_url(data.get('url'))
    kw = data.get('kwPrincipal', '')
    p_type = data.get('pageType', 'Otro')
    geo = data.get('geoTarget', '')
    cluster = data.get('cluster', '')
    page_id = data.get('pageId', '')
    gsc_queries = data.get('gscQueries', [])

    # New optional parameters for deep analysis
    # Maintain backward compatibility with old top-level params if analysisConfig is missing
    analysis_config = data.get('analysisConfig') or data.get('config')

    # Legacy fallbacks
    analyze_competitors = data.get('analyzeCompetitors', False)
    competitor_urls = data.get('competitorUrls', [])
    serp_api_confirmed = data.get('serpApiConfirmed', False)
    serp_provider = data.get('serpProvider')

    if not url:
        return jsonify({'error': 'URL is required'}), 400

    if not is_safe_url(url):
        return jsonify({'error': 'Invalid or unsafe URL'}), 400

    # Execute analysis
    result = run_orchestrated_checklist(
        url, kw, p_type, geo, cluster, gsc_queries,
        analyze_competitors=analyze_competitors,
        competitor_urls=competitor_urls,
        serp_api_confirmed=serp_api_confirmed,
        serp_provider=serp_provider,
        analysis_config=analysis_config
    )

    # Wrap with metadata
    response = {
        "pageId": page_id,
        "url": url,
        "generatedAt": datetime.utcnow().isoformat(),
        "items": result
    }

    # Add advanced execution status if available in result
    if 'advancedExecuted' in result:
        response['advancedExecuted'] = result['advancedExecuted']
    if 'advancedBlockedReason' in result:
        response['advancedBlockedReason'] = result['advancedBlockedReason']

    # Add applied limits and provider info
    if 'appliedLimits' in result:
        response['appliedLimits'] = result['appliedLimits']
    if 'providerUsed' in result:
        response['providerUsed'] = result['providerUsed']

    return jsonify(response)


@api_engine_bp.route('/api/ai/checklist-evaluate', methods=['POST'])
def checklist_evaluate():
    data = safe_get_json()

    checks = data.get('checks') or []
    context = data.get('context') or {}
    provider = data.get('provider') or 'openai'
    api_key = data.get('apiKey') or os.getenv('OPENAI_API_KEY')
    model = data.get('model')

    if not isinstance(checks, list) or not checks:
        return jsonify({'error': 'Debes enviar una lista no vacía en "checks".'}), 400

    if not api_key:
        return jsonify({'error': 'No hay API key configurada para evaluar la checklist con IA.'}), 400

    prompt = (
        "Evalúa checks SEO y decide solo con evidencia.\n"
        f"Contexto: {json.dumps(context, ensure_ascii=False)}\n"
        f"Checks: {json.dumps(checks, ensure_ascii=False)}\n"
        "Formato requerido:\n"
        "{\"results\":[{\"key\":\"...\",\"decision\":\"si_ia|error_claro_ia|no_decidir\",\"notes\":\"...\",\"error\":\"... opcional\"}],\"globalErrors\":[]}"
    )

    try:
        raw_response = _run_checklist_ai_evaluation(provider, api_key, model, prompt)
        parsed_response = _parse_checklist_ai_response(raw_response)
    except ValueError as exc:
        return jsonify({'error': 'No se pudo validar la respuesta de IA.', 'message': str(exc)}), 422
    except Exception:
        return jsonify({'error': 'Error controlado al ejecutar la evaluación IA.'}), 502

    return jsonify(parsed_response)

@api_engine_bp.route('/api/capabilities', methods=['GET'])
def capabilities():
    """
    Returns available providers and server hard limits.
    """
    settings = get_user_settings()

    # Check availability (Env vars take precedence or combine with settings)
    has_serpapi = bool(settings.get('serpapi_key') or os.environ.get('SERPAPI_KEY'))
    has_dfs = bool((settings.get('dataforseo_login') and settings.get('dataforseo_password')) or
                   (os.environ.get('DATAFORSEO_LOGIN') and os.environ.get('DATAFORSEO_PASSWORD')))

    serp_providers = {
        "serpapi": has_serpapi,
        "dataforseo": has_dfs,
        "internal": True
    }

    # Hard limits from Config
    max_kw = current_app.config.get('ENGINE_MAX_KEYWORDS_PER_URL', 20)
    max_comp = current_app.config.get('ENGINE_MAX_COMPETITORS_PER_KEYWORD', 5)
    max_urls = current_app.config.get('ENGINE_MAX_URLS_PER_BATCH', 100)

    limits = {
        "maxKeywordsPerUrl": max_kw,
        "maxCompetitorsPerKeyword": max_comp,
        "maxUrlsPerBatch": max_urls
    }

    cost_model = {
        "serpapi": {"unit": "query", "estimatedCostPerQuery": 0.01},
        "dataforseo": {"unit": "query", "estimatedCostPerQuery": 0.02},
        "internal": {"unit": "query", "estimatedCostPerQuery": 0.0}
    }

    return jsonify({
        "serpProviders": serp_providers,
        "limits": limits,
        "costModel": cost_model
    })

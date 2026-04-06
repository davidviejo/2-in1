import os
import json
from flask import jsonify, request, Blueprint
from apps.tools.utils import safe_get_json
from apps.core.database import (
    create_job, get_job, get_job_items, get_job_item_result,
    update_job_status, get_user_settings
)
from apps.job_runner import JobRunner
from . import api_engine_bp

# Hard limits
MAX_URLS_PER_BATCH = int(os.environ.get('ENGINE_MAX_URLS_PER_BATCH', 5000))

@api_engine_bp.route('/api/jobs', methods=['POST'])
def create_analysis_job():
    data = safe_get_json()
    items = data.get('items')
    urls = data.get('urls', [])
    analysis_config = data.get('analysisConfig') or data.get('config') or {}
    gsc_queries_map = data.get('gscQueriesByUrl', {})
    user_notes = data.get('userNotes', '')

    if items is None and urls:
        items = urls
    elif items is None:
        items = []

    if not items:
        return jsonify({'error': 'No URLs provided'}), 400

    if len(items) > MAX_URLS_PER_BATCH:
        return jsonify({'error': f'Batch size exceeds limit of {MAX_URLS_PER_BATCH}'}), 400

    # Store gscQueries in analysis_config so runner can access it
    analysis_config['gscQueriesByUrl'] = gsc_queries_map

    # --- Rule 4: Cost Guardrails & Advanced Mode Check ---
    advanced_allowed = False
    advanced_blocked_reason = None

    mode = analysis_config.get('mode')
    serp_section = analysis_config.get('serp', {})

    if mode == 'advanced' and serp_section.get('confirmed'):
        # Check provider
        provider = serp_section.get('provider')
        settings = get_user_settings()
        req_dfs_login = serp_section.get('dataforseoLogin')
        req_dfs_pass = serp_section.get('dataforseoPassword')

        has_creds = False
        if provider == 'serpapi':
            has_creds = bool(settings.get('serpapi_key') or os.environ.get('SERPAPI_KEY'))
        elif provider == 'dataforseo':
            has_creds = bool((req_dfs_login and req_dfs_pass) or
                             (settings.get('dataforseo_login') and settings.get('dataforseo_password')) or
                             (os.environ.get('DATAFORSEO_LOGIN') and os.environ.get('DATAFORSEO_PASSWORD')))
        elif provider == 'internal':
            has_creds = True
        elif provider == 'google_official':
            has_creds = bool(settings.get('cse_key') and settings.get('cse_cx'))

        if not has_creds:
            advanced_blocked_reason = f"Provider '{provider}' credentials missing."
        else:
            # Check cost limits (approx)
            max_cost_batch = float(os.environ.get('ENGINE_MAX_ESTIMATED_COST_PER_BATCH', 100.0))

            max_kw = int(serp_section.get('maxKeywordsPerUrl', 20))
            # Queries for competitors: 1 (if analyze_competitors or just to find them)
            # Queries for zero-click: up to max_kw.

            queries_per_url = 1 + max_kw
            estimated_queries = len(items) * queries_per_url

            # Unit cost depends on provider.
            unit_cost = 0.01 # Default
            if provider == 'dataforseo': unit_cost = 0.02
            if provider == 'internal': unit_cost = 0.0

            estimated_total_cost = estimated_queries * unit_cost

            if estimated_total_cost > max_cost_batch:
                advanced_blocked_reason = f"Estimated cost ${estimated_total_cost:.2f} exceeds batch limit ${max_cost_batch:.2f}."
            else:
                advanced_allowed = True
    else:
        if mode != 'advanced':
            advanced_blocked_reason = "Mode is not set to 'advanced'."
        elif not serp_section.get('confirmed'):
            advanced_blocked_reason = "SERP usage not confirmed."

    # Create Job
    job_data = {
        'analysisConfig': analysis_config,
        'user_notes': user_notes,
        'advancedAllowed': advanced_allowed,
        'advancedBlockedReason': advanced_blocked_reason
    }

    items_data = items

    try:
        job_id = create_job(job_data, items_data)

        # Start runner
        JobRunner.start_worker()

        return jsonify({
            "jobId": job_id,
            "status": "queued",
            "total": len(items),
            "advancedAllowed": advanced_allowed,
            "advancedBlockedReason": advanced_blocked_reason
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api_engine_bp.route('/api/jobs/runner/health', methods=['GET'])
def get_runner_health():
    return jsonify(JobRunner.runner_health())

@api_engine_bp.route('/api/jobs/<job_id>', methods=['GET'])
def get_job_status(job_id):
    job = get_job(job_id)
    if not job:
        return jsonify({'error': 'Job not found'}), 404

    return jsonify({
        "jobId": job['job_id'],
        "status": job['status'],
        "total": job['total_urls'],
        "processed": job['processed_urls'],
        "success": job['success_count'],
        "errors": job['error_count'],
        "advancedAllowed": bool(job['advanced_allowed']),
        "advancedBlockedReason": job['advanced_blocked_reason'],
        "createdAt": job['created_at'],
        "updatedAt": job['updated_at'],
        "lastError": job['last_error']
    })

@api_engine_bp.route('/api/jobs/<job_id>/items', methods=['GET'])
def get_job_items_route(job_id):
    status = request.args.get('status')
    status_filters = None

    if status:
        status_filters = [entry.strip() for entry in status.split(',') if entry.strip()]

    page = int(request.args.get('page', 1))
    page_size = int(request.args.get('pageSize', 50))

    result = get_job_items(job_id, status_filters, page, page_size)
    return jsonify(result)

@api_engine_bp.route('/api/jobs/<job_id>/items/<item_id>/result', methods=['GET'])
def get_item_result_route(job_id, item_id):
    res = get_job_item_result(job_id, item_id)
    if res is None:
        return jsonify({'error': 'Result not available or item not found'}), 404

    # Keep passthrough for already-normalized responses while guaranteeing
    # AnalysisResponse shape for newly processed items.
    if isinstance(res, dict) and 'pageId' in res and 'items' in res:
        return jsonify(res)

    normalized = {
        'pageId': (res or {}).get('pageId') if isinstance(res, dict) else None,
        'items': (res or {}).get('items') if isinstance(res, dict) and isinstance(res.get('items'), dict) else (res if isinstance(res, dict) else {}),
    }

    if not normalized['pageId']:
        normalized['pageId'] = item_id

    if isinstance(res, dict):
        for key in ('url', 'generatedAt', 'advancedBlockedReason', 'advancedExecuted', 'engineMeta'):
            if key in res:
                normalized[key] = res[key]

    return jsonify(normalized)

@api_engine_bp.route('/api/jobs/<job_id>/pause', methods=['POST'])
def pause_job(job_id):
    job = get_job(job_id)
    if not job: return jsonify({'error': 'Job not found'}), 404

    if job['status'] in ['running', 'queued']:
        update_job_status(job_id, 'paused')
        return jsonify({'status': 'paused'})

    return jsonify({'error': f"Cannot pause job in '{job['status']}' state"}), 400

@api_engine_bp.route('/api/jobs/<job_id>/resume', methods=['POST'])
def resume_job(job_id):
    job = get_job(job_id)
    if not job: return jsonify({'error': 'Job not found'}), 404

    if job['status'] == 'paused':
        update_job_status(job_id, 'queued')
        JobRunner.start_worker()
        return jsonify({'status': 'queued'})

    return jsonify({'error': f"Cannot resume job in '{job['status']}' state"}), 400

@api_engine_bp.route('/api/jobs/<job_id>/cancel', methods=['POST'])
def cancel_job(job_id):
    job = get_job(job_id)
    if not job: return jsonify({'error': 'Job not found'}), 404

    if job['status'] not in ['completed', 'failed', 'cancelled']:
        update_job_status(job_id, 'cancelled')
        return jsonify({'status': 'cancelled'})

    return jsonify({'error': f"Cannot cancel job in '{job['status']}' state"}), 400

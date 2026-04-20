from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, make_response, session, redirect, url_for, render_template
from apps.web.clients_store import get_safe_clients
from apps.web.template_catalog import get_template_catalog
from apps.web.tools_catalog import get_tools_catalog
from apps.web.launcher_catalog import get_launcher_catalog
from apps.web.launcher_runtime import launcher_runtime_service, LauncherRuntimeError, serialize_runtime_response
from functools import wraps
from collections import deque
from apps.web.authz import extract_bearer_token_from_header, get_payload_from_token, require_role

portal_bp = Blueprint('portal_bp', __name__)

WEB_AUTH_COOKIE = 'portal_auth_token'
OPERATOR_EXECUTION_MODE = 'simulation'
OPERATOR_AUDIT_LIMIT = 200
OPERATOR_AUDIT_LOG = deque(maxlen=OPERATOR_AUDIT_LIMIT)


def _get_web_payload():
    """
    Resolve auth payload for HTML views.
    Priority: Flask session payload -> JWT in session -> JWT in HttpOnly cookie -> Bearer header.
    """
    payload = session.get('auth_payload')
    if payload:
        return payload

    for token in (
        session.get('auth_token'),
        request.cookies.get(WEB_AUTH_COOKIE),
        extract_bearer_token_from_header(),
    ):
        payload = get_payload_from_token(token)
        if payload:
            session['auth_payload'] = payload
            return payload

    return None


def require_role_web(allowed_roles, login_endpoint='home'):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            payload = _get_web_payload()

            if not payload:
                return redirect(url_for(login_endpoint))

            if payload.get('role') not in allowed_roles:
                return redirect(url_for(login_endpoint))

            request.user_payload = payload
            return f(*args, **kwargs)

        return decorated_function

    return decorator

@portal_bp.route('/api/clients', methods=['GET'])
@require_role(['clients_area', 'operator'])
def list_clients():
    return jsonify(get_safe_clients())

@portal_bp.route('/api/public/clients', methods=['GET'])
def list_public_clients():
    response = make_response(jsonify(get_safe_clients()))
    response.headers['Cache-Control'] = 'public, max-age=60, stale-while-revalidate=300'
    return response

@portal_bp.route('/api/<slug>/overview', methods=['GET'])
@require_role(['project', 'clients_area', 'operator'])
def project_overview(slug):
    # If role is project, ensure scope matches slug
    payload = request.user_payload
    if payload.get('role') == 'project' and payload.get('scope') != slug:
        return jsonify({'error': 'Access denied for this project'}), 403

    # Return mock data
    return jsonify({
        "project": slug,
        "traffic": "12.5K",
        "keywords_top3": 45,
        "health_score": 92,
        "recent_issues": [
            "Missing H1 on 3 pages",
            "Slow LCP on homepage"
        ]
    })

@portal_bp.route('/api/tools/run/<tool>', methods=['POST'])
@require_role(['operator'])
def run_tool(tool):
    payload = request.user_payload or {}
    executed_at = datetime.now(timezone.utc).isoformat()
    audit_entry = {
        'tool': tool,
        'mode': OPERATOR_EXECUTION_MODE,
        'executed_at': executed_at,
        'executed_by': payload.get('sub') or payload.get('role') or 'operator',
        'role': payload.get('role', 'operator'),
        'ip': request.remote_addr,
    }
    OPERATOR_AUDIT_LOG.appendleft(audit_entry)

    return jsonify({
        "status": "accepted",
        "message": f"Tool {tool} execution queued ({OPERATOR_EXECUTION_MODE})",
        "tool": tool,
        "mode": OPERATOR_EXECUTION_MODE,
        "trace": audit_entry,
    })


@portal_bp.route('/api/tools/executions', methods=['GET'])
@require_role(['operator'])
def list_tool_executions():
    return jsonify({
        'mode': OPERATOR_EXECUTION_MODE,
        'items': list(OPERATOR_AUDIT_LOG),
    })




@portal_bp.route('/api/templates', methods=['GET'])
def templates_catalog():
    response = make_response(jsonify(get_template_catalog()))
    response.headers['Cache-Control'] = 'public, max-age=60, stale-while-revalidate=300'
    return response


@portal_bp.route('/api/launcher/catalog', methods=['GET'])
def launcher_catalog():
    response = make_response(jsonify(get_launcher_catalog()))
    response.headers['Cache-Control'] = 'public, max-age=30, stale-while-revalidate=120'
    return response



def _launcher_catalog_index() -> dict[str, dict]:
    catalog = get_launcher_catalog()
    return {item.get('id'): item for item in catalog.get('apps', []) if item.get('id')}


def _resolve_launcher_app_or_404(app_id: str):
    app_entry = _launcher_catalog_index().get(app_id)
    if not app_entry:
        return None, (jsonify({
            'ok': False,
            'app_id': app_id,
            'state': 'error',
            'pid': None,
            'port': None,
            'message': 'App no encontrada en el catálogo del launcher.',
            'error': 'app_not_found',
        }), 404)
    return app_entry, None


def _handle_launcher_runtime_error(app_id: str, exc: LauncherRuntimeError):
    record = launcher_runtime_service.status(app_id)
    return jsonify(serialize_runtime_response(
        record,
        ok=False,
        message=str(exc),
        error=exc.error or 'runtime_error',
        state=exc.state or record.state,
    )), exc.status_code


@portal_bp.route('/api/launcher/apps/<app_id>/install', methods=['POST'])
def launcher_install(app_id):
    _, not_found = _resolve_launcher_app_or_404(app_id)
    if not_found:
        return not_found

    try:
        record = launcher_runtime_service.install(app_id)
        return jsonify(serialize_runtime_response(record))
    except LauncherRuntimeError as exc:
        return _handle_launcher_runtime_error(app_id, exc)
    except Exception as exc:
        record = launcher_runtime_service.status(app_id)
        return jsonify(serialize_runtime_response(
            record,
            ok=False,
            message='Error interno al instalar app.',
            error=str(exc),
            state='error',
        )), 500


@portal_bp.route('/api/launcher/apps/<app_id>/start', methods=['POST'])
def launcher_start(app_id):
    _, not_found = _resolve_launcher_app_or_404(app_id)
    if not_found:
        return not_found

    try:
        record = launcher_runtime_service.start(app_id)
        return jsonify(serialize_runtime_response(record))
    except LauncherRuntimeError as exc:
        return _handle_launcher_runtime_error(app_id, exc)
    except Exception as exc:
        record = launcher_runtime_service.status(app_id)
        return jsonify(serialize_runtime_response(
            record,
            ok=False,
            message='Error interno al arrancar app.',
            error=str(exc),
            state='error',
        )), 500


@portal_bp.route('/api/launcher/apps/<app_id>/stop', methods=['POST'])
def launcher_stop(app_id):
    _, not_found = _resolve_launcher_app_or_404(app_id)
    if not_found:
        return not_found

    try:
        record = launcher_runtime_service.stop(app_id)
        return jsonify(serialize_runtime_response(record))
    except LauncherRuntimeError as exc:
        return _handle_launcher_runtime_error(app_id, exc)
    except Exception as exc:
        record = launcher_runtime_service.status(app_id)
        return jsonify(serialize_runtime_response(
            record,
            ok=False,
            message='Error interno al detener app.',
            error=str(exc),
            state='error',
        )), 500


@portal_bp.route('/api/launcher/apps/<app_id>/status', methods=['GET'])
def launcher_status(app_id):
    _, not_found = _resolve_launcher_app_or_404(app_id)
    if not_found:
        return not_found

    try:
        record = launcher_runtime_service.status(app_id)
        return jsonify(serialize_runtime_response(record))
    except Exception as exc:
        record = launcher_runtime_service.status(app_id)
        return jsonify(serialize_runtime_response(
            record,
            ok=False,
            message='Error interno al consultar estado.',
            error=str(exc),
            state='error',
        )), 500


@portal_bp.route('/api/launcher/apps/<app_id>/logs', methods=['GET'])
def launcher_logs(app_id):
    _, not_found = _resolve_launcher_app_or_404(app_id)
    if not_found:
        return not_found

    raw_tail = request.args.get('tail', default='200')
    try:
        tail = int(raw_tail)
    except (TypeError, ValueError):
        record = launcher_runtime_service.status(app_id)
        return jsonify(serialize_runtime_response(
            record,
            ok=False,
            message='Parámetro tail inválido.',
            error='invalid_tail',
            state=record.state,
        )), 400

    try:
        record, logs = launcher_runtime_service.logs(app_id, tail=tail)
        return jsonify(serialize_runtime_response(
            record,
            extra={'logs': logs, 'tail': tail},
        ))
    except LauncherRuntimeError as exc:
        return _handle_launcher_runtime_error(app_id, exc)
    except Exception as exc:
        record = launcher_runtime_service.status(app_id)
        return jsonify(serialize_runtime_response(
            record,
            ok=False,
            message='Error interno al consultar logs.',
            error=str(exc),
            state='error',
        )), 500

@portal_bp.route('/api/tools/catalog', methods=['GET'])
def tools_catalog():
    response = make_response(jsonify({'tools': get_tools_catalog()}))
    response.headers['Cache-Control'] = 'public, max-age=60, stale-while-revalidate=300'
    return response


@portal_bp.route('/tools/hub', methods=['GET'])
def tools_hub():
    return render_template('tools_hub.html', tools=get_tools_catalog())

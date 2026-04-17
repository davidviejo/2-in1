import json
from collections import defaultdict, deque
from threading import Lock
from time import time

from flask import Blueprint, request, jsonify, current_app, session, make_response

from apps.auth_utils import check_global_password, create_token, check_password_hash
from apps.web.clients_store import find_client_by_slug
from apps.web.portal_bp import WEB_AUTH_COOKIE

auth_bp = Blueprint('auth_bp', __name__)

_AUTH_LOCK = Lock()
_IP_ATTEMPTS = defaultdict(deque)
_FAILED_ATTEMPTS = {}


def _now_ts():
    return time()


def _build_auth_response(token, role, scope=None):
    payload = {'token': token, 'role': role}
    if scope:
        payload['scope'] = scope

    session['auth_token'] = token
    session['auth_payload'] = {'role': role, 'scope': scope}

    response = make_response(jsonify(payload))
    response.set_cookie(
        WEB_AUTH_COOKIE,
        token,
        httponly=True,
        samesite='Lax',
        secure=bool(current_app.config.get('SESSION_COOKIE_SECURE', False)),
        max_age=24 * 60 * 60,
    )
    return response


def _require_initialized_auth(*required_keys):
    missing = []

    for key in required_keys:
        value = current_app.config.get(key)
        if not value or not isinstance(value, str) or not value.startswith('$2'):
            missing.append(key)

    if not missing:
        return None

    return jsonify(
        {
            'error': (
                'Authentication is not initialized securely. '
                'Generate bcrypt hashes and set them in backend/p2/.env.'
            ),
            'code': 'auth_not_initialized',
            'missing': missing,
        }
    ), 503


def _security_limits():
    return {
        'ip_window_seconds': max(1, int(current_app.config.get('AUTH_RATE_LIMIT_WINDOW_SECONDS', 60))),
        'ip_max_attempts': max(1, int(current_app.config.get('AUTH_RATE_LIMIT_MAX_ATTEMPTS', 10))),
        'backoff_base_seconds': max(1, int(current_app.config.get('AUTH_BACKOFF_BASE_SECONDS', 10))),
        'backoff_max_seconds': max(1, int(current_app.config.get('AUTH_BACKOFF_MAX_SECONDS', 300))),
    }


def _client_ip():
    forwarded_for = request.headers.get('X-Forwarded-For', '').split(',')[0].strip()
    return forwarded_for or request.remote_addr or 'unknown'


def _log_auth_event(event, route_name, ip, identity_key, status_code, reason=None, slug=None, failed_attempts=0, blocked_seconds=0):
    audit_payload = {
        'event': event,
        'route': route_name,
        'ip': ip,
        'identity_key': identity_key,
        'slug': slug,
        'reason': reason,
        'status_code': status_code,
        'failed_attempts': failed_attempts,
        'blocked_seconds': blocked_seconds,
        'timestamp': int(_now_ts()),
    }
    current_app.logger.info('auth_event=%s', json.dumps(audit_payload, sort_keys=True))


def _check_ip_window_limit(ip):
    limits = _security_limits()
    now = _now_ts()
    with _AUTH_LOCK:
        entries = _IP_ATTEMPTS[ip]
        while entries and now - entries[0] >= limits['ip_window_seconds']:
            entries.popleft()

        if len(entries) >= limits['ip_max_attempts']:
            retry_after = limits['ip_window_seconds'] - int(now - entries[0])
            return max(1, retry_after)

        entries.append(now)

    return None


def _check_identity_backoff(identity_key):
    now = _now_ts()
    with _AUTH_LOCK:
        state = _FAILED_ATTEMPTS.get(identity_key)
        if not state:
            return None

        blocked_until = state.get('blocked_until', 0)
        if blocked_until <= now:
            return None

        return max(1, int(blocked_until - now))


def _register_auth_failure(identity_key):
    limits = _security_limits()
    now = _now_ts()
    with _AUTH_LOCK:
        state = _FAILED_ATTEMPTS.setdefault(identity_key, {'count': 0, 'blocked_until': 0})
        state['count'] += 1
        penalty = min(limits['backoff_base_seconds'] * (2 ** (state['count'] - 1)), limits['backoff_max_seconds'])
        state['blocked_until'] = now + penalty
        return state['count'], int(penalty)


def _register_auth_success(identity_key):
    with _AUTH_LOCK:
        _FAILED_ATTEMPTS.pop(identity_key, None)


def _blocked_response(code='auth_temporarily_blocked'):
    return jsonify({'error': 'Too many attempts. Try again later.', 'code': code}), 429


def _invalid_credentials_response():
    return jsonify({'error': 'Invalid credentials'}), 401


def _validate_pre_auth(route_name, identity_key, slug=None):
    ip = _client_ip()

    ip_wait_seconds = _check_ip_window_limit(ip)
    if ip_wait_seconds is not None:
        _log_auth_event(
            event='auth_blocked',
            route_name=route_name,
            ip=ip,
            identity_key=identity_key,
            status_code=429,
            reason='ip_rate_limit',
            slug=slug,
            blocked_seconds=ip_wait_seconds,
        )
        return _blocked_response(code='auth_rate_limited'), ip

    identity_wait_seconds = _check_identity_backoff(identity_key)
    if identity_wait_seconds is not None:
        _log_auth_event(
            event='auth_blocked',
            route_name=route_name,
            ip=ip,
            identity_key=identity_key,
            status_code=429,
            reason='identity_backoff',
            slug=slug,
            blocked_seconds=identity_wait_seconds,
        )
        return _blocked_response(code='auth_identity_backoff'), ip

    return None, ip


def _extract_json_payload():
    payload = request.get_json(silent=True)
    if isinstance(payload, dict):
        return payload
    return {}


@auth_bp.route('/api/auth/clients-area', methods=['POST'])
def auth_clients_area():
    auth_init_error = _require_initialized_auth('CLIENTS_AREA_PASSWORD')
    if auth_init_error:
        return auth_init_error

    route_name = 'clients-area'
    data = _extract_json_payload()
    password = data.get('password')
    identity_key = f"{_client_ip()}::clients-area"

    blocked_response, ip = _validate_pre_auth(route_name, identity_key)
    if blocked_response:
        return blocked_response

    if password and check_global_password(password, 'CLIENTS_AREA_PASSWORD'):
        _register_auth_success(identity_key)
        _log_auth_event('auth_success', route_name, ip, identity_key, 200)
        token = create_token(role='clients_area')
        return _build_auth_response(token, 'clients_area')

    failed_attempts, blocked_seconds = _register_auth_failure(identity_key)
    _log_auth_event('auth_failure', route_name, ip, identity_key, 401, reason='invalid_credentials', failed_attempts=failed_attempts, blocked_seconds=blocked_seconds)
    return _invalid_credentials_response()


@auth_bp.route('/api/auth/project/<slug>', methods=['POST'])
def auth_project(slug):
    auth_init_error = _require_initialized_auth('OPERATOR_PASSWORD')
    if auth_init_error:
        return auth_init_error

    route_name = 'project'
    data = _extract_json_payload()
    password = data.get('password')
    normalized_slug = (slug or '').strip().lower() or 'unknown'
    ip = _client_ip()
    identity_key = f'{ip}::project::{normalized_slug}'

    blocked_response, ip = _validate_pre_auth(route_name, identity_key, slug=normalized_slug)
    if blocked_response:
        return blocked_response

    # Master Password (Operator) Bypass
    if password and check_global_password(password, 'OPERATOR_PASSWORD'):
        _register_auth_success(identity_key)
        _log_auth_event('auth_success', route_name, ip, identity_key, 200, reason='operator_bypass', slug=normalized_slug)
        token = create_token(role='operator')
        return _build_auth_response(token, 'operator')

    project = find_client_by_slug(slug)
    if password and project and check_password_hash(password, project.get('project_password_hash')):
        _register_auth_success(identity_key)
        _log_auth_event('auth_success', route_name, ip, identity_key, 200, reason='project_access', slug=normalized_slug)
        token = create_token(role='project', scope=slug)
        return _build_auth_response(token, 'project', scope=slug)

    failed_attempts, blocked_seconds = _register_auth_failure(identity_key)
    _log_auth_event('auth_failure', route_name, ip, identity_key, 401, reason='invalid_credentials', slug=normalized_slug, failed_attempts=failed_attempts, blocked_seconds=blocked_seconds)
    return _invalid_credentials_response()


@auth_bp.route('/api/auth/operator', methods=['POST'])
def auth_operator():
    auth_init_error = _require_initialized_auth('OPERATOR_PASSWORD')
    if auth_init_error:
        return auth_init_error

    route_name = 'operator'
    data = _extract_json_payload()
    password = data.get('password')
    identity_key = f"{_client_ip()}::operator"

    blocked_response, ip = _validate_pre_auth(route_name, identity_key)
    if blocked_response:
        return blocked_response

    if password and check_global_password(password, 'OPERATOR_PASSWORD'):
        _register_auth_success(identity_key)
        _log_auth_event('auth_success', route_name, ip, identity_key, 200)
        token = create_token(role='operator')
        return _build_auth_response(token, 'operator')

    failed_attempts, blocked_seconds = _register_auth_failure(identity_key)
    _log_auth_event('auth_failure', route_name, ip, identity_key, 401, reason='invalid_credentials', failed_attempts=failed_attempts, blocked_seconds=blocked_seconds)
    return _invalid_credentials_response()

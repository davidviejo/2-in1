from flask import Blueprint, request, jsonify, current_app, session, make_response
from apps.auth_utils import check_global_password, create_token, check_password_hash
from apps.web.clients_store import find_client_by_slug
from apps.web.portal_bp import WEB_AUTH_COOKIE

auth_bp = Blueprint('auth_bp', __name__)


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

@auth_bp.route('/api/auth/clients-area', methods=['POST'])
def auth_clients_area():
    data = request.get_json()
    password = data.get('password')

    if not password:
        return jsonify({'error': 'Password required'}), 400

    if check_global_password(password, 'CLIENTS_AREA_PASSWORD'):
        token = create_token(role='clients_area')
        return _build_auth_response(token, 'clients_area')

    return jsonify({'error': 'Invalid password'}), 401

@auth_bp.route('/api/auth/project/<slug>', methods=['POST'])
def auth_project(slug):
    data = request.get_json()
    password = data.get('password')

    if not password:
        return jsonify({'error': 'Password required'}), 400

    # Master Password (Operator) Bypass
    if check_global_password(password, 'OPERATOR_PASSWORD'):
        token = create_token(role='operator')
        return _build_auth_response(token, 'operator')

    # Check project password
    project = find_client_by_slug(slug)

    if not project:
        return jsonify({'error': 'Project not found'}), 404

    if check_password_hash(password, project.get('project_password_hash')):
        token = create_token(role='project', scope=slug)
        return _build_auth_response(token, 'project', scope=slug)

    return jsonify({'error': 'Invalid password'}), 401

@auth_bp.route('/api/auth/operator', methods=['POST'])
def auth_operator():
    data = request.get_json()
    password = data.get('password')

    if not password:
        return jsonify({'error': 'Password required'}), 400

    if check_global_password(password, 'OPERATOR_PASSWORD'):
        token = create_token(role='operator')
        return _build_auth_response(token, 'operator')

    return jsonify({'error': 'Invalid password'}), 401

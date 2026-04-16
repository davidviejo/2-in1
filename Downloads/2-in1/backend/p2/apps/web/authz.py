from functools import wraps

from flask import jsonify, request

from apps.auth_utils import verify_token


def extract_bearer_token_from_header():
    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith('Bearer '):
        return auth_header.split(' ', 1)[1].strip()
    return None


def get_payload_from_token(token):
    if not token:
        return None
    return verify_token(token)


def require_role(allowed_roles):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            token = extract_bearer_token_from_header()
            if not token:
                return jsonify({'error': 'Missing or invalid Authorization header'}), 401

            payload = get_payload_from_token(token)
            if not payload:
                return jsonify({'error': 'Invalid or expired token'}), 401

            if payload.get('role') not in allowed_roles:
                return jsonify({'error': 'Insufficient permissions'}), 403

            request.user_payload = payload
            return f(*args, **kwargs)

        return decorated_function

    return decorator

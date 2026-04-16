from unittest.mock import patch

from apps.web import create_app


class MissingAuthConfig:
    TESTING = True
    SECRET_KEY = 'test-secret'
    JWT_SECRET = 'test-jwt'
    DEFAULT_COOKIE = 'test-cookie'
    MAX_CONTENT_LENGTH = 1024 * 1024
    FRONTEND_URL = 'http://localhost:5173'
    USER_AGENTS = []
    DATAFORSEO_LOGIN = None
    DATAFORSEO_PASSWORD = None
    CLIENTS_AREA_PASSWORD = None
    OPERATOR_PASSWORD = None


def _client_with_missing_auth_config():
    with patch('apps.web.init_db'), patch('apps.web.start_monitor'):
        app = create_app(MissingAuthConfig)
    return app.test_client()


def test_operator_login_fails_when_auth_not_initialized():
    client = _client_with_missing_auth_config()

    response = client.post('/api/auth/operator', json={'password': 'anything'})

    assert response.status_code == 503
    payload = response.get_json()
    assert payload['code'] == 'auth_not_initialized'
    assert 'OPERATOR_PASSWORD' in payload['missing']


def test_clients_area_login_fails_when_auth_not_initialized():
    client = _client_with_missing_auth_config()

    response = client.post('/api/auth/clients-area', json={'password': 'anything'})

    assert response.status_code == 503
    payload = response.get_json()
    assert payload['code'] == 'auth_not_initialized'
    assert 'CLIENTS_AREA_PASSWORD' in payload['missing']

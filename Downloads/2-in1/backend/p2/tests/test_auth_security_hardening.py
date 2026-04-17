import json
from unittest.mock import patch

from apps.auth_utils import hash_password
from apps.web import create_app
from apps.web import auth_bp as auth_module


class AuthSecurityConfig:
    TESTING = True
    SECRET_KEY = 'test-secret'
    JWT_SECRET = 'test-jwt'
    DEFAULT_COOKIE = 'test-cookie'
    MAX_CONTENT_LENGTH = 1024 * 1024
    FRONTEND_URL = 'http://localhost:5173'
    USER_AGENTS = []
    DATAFORSEO_LOGIN = None
    DATAFORSEO_PASSWORD = None
    CLIENTS_AREA_PASSWORD = hash_password('clients-ok')
    OPERATOR_PASSWORD = hash_password('operator-ok')
    AUTH_RATE_LIMIT_WINDOW_SECONDS = 60
    AUTH_RATE_LIMIT_MAX_ATTEMPTS = 3
    AUTH_BACKOFF_BASE_SECONDS = 5
    AUTH_BACKOFF_MAX_SECONDS = 30


def _build_client():
    with patch('apps.web.init_db'), patch('apps.web.start_monitor'):
        app = create_app(AuthSecurityConfig)
    return app.test_client()


def _reset_auth_state(monkeypatch):
    with auth_module._AUTH_LOCK:
        auth_module._IP_ATTEMPTS.clear()
        auth_module._FAILED_ATTEMPTS.clear()

    now = {'value': 1_000.0}
    monkeypatch.setattr(auth_module, '_now_ts', lambda: now['value'])
    return now


def test_ip_rate_limit_blocks_after_window_quota(monkeypatch):
    client = _build_client()
    _reset_auth_state(monkeypatch)

    for _ in range(3):
        response = client.post('/api/auth/clients-area', json={'password': 'wrong'})
        assert response.status_code == 401

    blocked = client.post('/api/auth/clients-area', json={'password': 'wrong'})
    assert blocked.status_code == 429
    assert blocked.get_json()['code'] == 'auth_rate_limited'


def test_identity_backoff_blocks_and_recovers(monkeypatch):
    client = _build_client()
    now = _reset_auth_state(monkeypatch)

    with patch('apps.web.auth_bp.find_client_by_slug', return_value={'project_password_hash': hash_password('project-ok')}):
        first_fail = client.post('/api/auth/project/acme', json={'password': 'wrong'})
        assert first_fail.status_code == 401

        blocked = client.post('/api/auth/project/acme', json={'password': 'wrong'})
        assert blocked.status_code == 429
        assert blocked.get_json()['code'] == 'auth_identity_backoff'

        now['value'] += 5
        second_fail = client.post('/api/auth/project/acme', json={'password': 'wrong'})
        assert second_fail.status_code == 401

        blocked_again = client.post('/api/auth/project/acme', json={'password': 'wrong'})
        assert blocked_again.status_code == 429

        now['value'] += 10
        success = client.post('/api/auth/project/acme', json={'password': 'project-ok'})
        assert success.status_code == 200

        now['value'] += 1
        post_recovery_fail = client.post('/api/auth/project/acme', json={'password': 'wrong'})
        assert post_recovery_fail.status_code == 401


def test_project_auth_response_is_uniform_for_missing_and_bad_credentials(monkeypatch):
    client = _build_client()
    now = _reset_auth_state(monkeypatch)

    with patch('apps.web.auth_bp.find_client_by_slug', return_value=None):
        missing_project = client.post('/api/auth/project/ghost', json={'password': 'wrong'})

    now['value'] += 10
    with patch('apps.web.auth_bp.find_client_by_slug', return_value={'project_password_hash': hash_password('real-pass')}):
        wrong_password = client.post('/api/auth/project/real', json={'password': 'wrong'})

    assert missing_project.status_code == 401
    assert wrong_password.status_code == 401
    assert missing_project.get_json() == wrong_password.get_json() == {'error': 'Invalid credentials'}


def test_auth_audit_events_include_success_failure_and_block(monkeypatch, caplog):
    client = _build_client()
    now = _reset_auth_state(monkeypatch)

    caplog.set_level('INFO')

    failed = client.post('/api/auth/operator', json={'password': 'wrong'})
    assert failed.status_code == 401

    blocked = client.post('/api/auth/operator', json={'password': 'wrong'})
    assert blocked.status_code == 429

    now['value'] += 5
    success = client.post('/api/auth/operator', json={'password': 'operator-ok'})
    assert success.status_code == 200

    auth_events = []
    for record in caplog.records:
        message = record.getMessage()
        if 'auth_event=' not in message:
            continue
        auth_events.append(json.loads(message.split('auth_event=', 1)[1]))

    event_types = {entry['event'] for entry in auth_events}
    assert {'auth_failure', 'auth_blocked', 'auth_success'}.issubset(event_types)

    for entry in auth_events:
        assert entry['route'] in {'operator', 'clients-area', 'project'}
        assert entry['ip']
        assert entry['identity_key']
        assert entry['status_code'] in {200, 401, 429}
        assert 'timestamp' in entry

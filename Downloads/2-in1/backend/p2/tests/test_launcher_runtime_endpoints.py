import pytest

from apps.web.launcher_runtime import LauncherRuntimeError, LauncherRuntimeService

APP_ID = 'frontend-dashboard'


@pytest.fixture(autouse=True)
def fresh_runtime_service(monkeypatch):
    service = LauncherRuntimeService()
    monkeypatch.setattr('apps.web.portal_bp.launcher_runtime_service', service)
    return service


def _assert_uniform_payload(payload, app_id=APP_ID):
    assert set(payload).issuperset({'ok', 'app_id', 'state', 'pid', 'port', 'message', 'error'})
    assert payload['app_id'] == app_id
    assert payload['state'] in {'installing', 'starting', 'running', 'stopped', 'error'}


def test_install_happy_path(client):
    response = client.post(f'/api/launcher/apps/{APP_ID}/install')
    assert response.status_code == 200
    payload = response.get_json()
    _assert_uniform_payload(payload)
    assert payload['ok'] is True
    assert payload['state'] == 'stopped'


def test_install_error_conflict_when_running(client):
    client.post(f'/api/launcher/apps/{APP_ID}/install')
    client.post(f'/api/launcher/apps/{APP_ID}/start')

    response = client.post(f'/api/launcher/apps/{APP_ID}/install')
    assert response.status_code == 409
    payload = response.get_json()
    _assert_uniform_payload(payload)
    assert payload['ok'] is False


def test_start_happy_path(client):
    client.post(f'/api/launcher/apps/{APP_ID}/install')

    response = client.post(f'/api/launcher/apps/{APP_ID}/start')
    assert response.status_code == 200
    payload = response.get_json()
    _assert_uniform_payload(payload)
    assert payload['ok'] is True
    assert payload['state'] == 'running'
    assert isinstance(payload['pid'], int)


def test_start_error_not_installed(client):
    response = client.post(f'/api/launcher/apps/{APP_ID}/start')
    assert response.status_code == 409
    payload = response.get_json()
    _assert_uniform_payload(payload)
    assert payload['ok'] is False


def test_stop_happy_path(client):
    client.post(f'/api/launcher/apps/{APP_ID}/install')
    client.post(f'/api/launcher/apps/{APP_ID}/start')

    response = client.post(f'/api/launcher/apps/{APP_ID}/stop')
    assert response.status_code == 200
    payload = response.get_json()
    _assert_uniform_payload(payload)
    assert payload['ok'] is True
    assert payload['state'] == 'stopped'
    assert payload['pid'] is None


def test_stop_error_not_running(client):
    client.post(f'/api/launcher/apps/{APP_ID}/install')

    response = client.post(f'/api/launcher/apps/{APP_ID}/stop')
    assert response.status_code == 409
    payload = response.get_json()
    _assert_uniform_payload(payload)
    assert payload['ok'] is False


def test_status_happy_path(client):
    response = client.get(f'/api/launcher/apps/{APP_ID}/status')
    assert response.status_code == 200
    payload = response.get_json()
    _assert_uniform_payload(payload)
    assert payload['ok'] is True


def test_status_error_unknown_app_returns_404(client):
    response = client.get('/api/launcher/apps/not-in-catalog/status')
    assert response.status_code == 404
    payload = response.get_json()
    _assert_uniform_payload(payload, app_id='not-in-catalog')
    assert payload['ok'] is False


def test_logs_happy_path_with_tail(client):
    client.post(f'/api/launcher/apps/{APP_ID}/install')
    client.post(f'/api/launcher/apps/{APP_ID}/start')

    response = client.get(f'/api/launcher/apps/{APP_ID}/logs?tail=2')
    assert response.status_code == 200
    payload = response.get_json()
    _assert_uniform_payload(payload)
    assert payload['ok'] is True
    assert payload['tail'] == 2
    assert isinstance(payload['logs'], list)
    assert len(payload['logs']) <= 2


def test_logs_error_invalid_tail_returns_400(client):
    response = client.get(f'/api/launcher/apps/{APP_ID}/logs?tail=nope')
    assert response.status_code == 400
    payload = response.get_json()
    _assert_uniform_payload(payload)
    assert payload['ok'] is False


def test_logs_error_non_positive_tail_returns_400(client):
    response = client.get(f'/api/launcher/apps/{APP_ID}/logs?tail=0')
    assert response.status_code == 400
    payload = response.get_json()
    _assert_uniform_payload(payload)
    assert payload['ok'] is False


@pytest.mark.parametrize('method,path', [
    ('post', '/api/launcher/apps/not-in-catalog/install'),
    ('post', '/api/launcher/apps/not-in-catalog/start'),
    ('post', '/api/launcher/apps/not-in-catalog/stop'),
    ('get', '/api/launcher/apps/not-in-catalog/logs'),
])
def test_endpoints_validate_app_exists(client, method, path):
    response = getattr(client, method)(path)
    assert response.status_code == 404
    payload = response.get_json()
    _assert_uniform_payload(payload, app_id='not-in-catalog')
    assert payload['ok'] is False


def test_start_internal_error_returns_500(client, monkeypatch):
    client.post(f'/api/launcher/apps/{APP_ID}/install')

    def _boom(_app_id):
        raise RuntimeError('boom')

    monkeypatch.setattr('apps.web.portal_bp.launcher_runtime_service.start', _boom)

    response = client.post(f'/api/launcher/apps/{APP_ID}/start')
    assert response.status_code == 500
    payload = response.get_json()
    _assert_uniform_payload(payload)
    assert payload['ok'] is False
    assert payload['state'] == 'error'


def test_runtime_error_handler_uses_explicit_state(client, monkeypatch):
    def _known_error(_app_id):
        raise LauncherRuntimeError('invalid state', status_code=409, state='starting', error='runtime_error')

    monkeypatch.setattr('apps.web.portal_bp.launcher_runtime_service.start', _known_error)

    response = client.post(f'/api/launcher/apps/{APP_ID}/start')
    assert response.status_code == 409
    payload = response.get_json()
    _assert_uniform_payload(payload)
    assert payload['ok'] is False
    assert payload['state'] == 'starting'

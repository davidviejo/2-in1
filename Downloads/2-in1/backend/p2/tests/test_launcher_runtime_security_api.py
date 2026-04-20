from __future__ import annotations

from unittest.mock import patch

import pytest

from apps.core.config import Config
from apps.web import create_app
from apps.web.launcher_runtime import LauncherRuntimeManager


class TestConfig(Config):
    TESTING = True


class _FakeProcess:
    def __init__(self, pid: int = 1234, exit_code: int = 0):
        self.pid = pid
        self._exit_code = exit_code

    def wait(self) -> int:
        return self._exit_code


@pytest.fixture
def client():
    with patch('apps.web.init_db'):
        app = create_app(TestConfig)

    manager = LauncherRuntimeManager(
        repo_root=LauncherRuntimeManager.DEFAULT_ALLOWED_ROOT,
        allowed_root=LauncherRuntimeManager.DEFAULT_ALLOWED_ROOT,
        catalog_provider=lambda: {'apps': []},
        popen_factory=lambda *args, **kwargs: _FakeProcess(),
    )
    app.extensions['launcher_runtime_manager'] = manager

    with app.test_client() as flask_client:
        yield flask_client, manager


def _auth_headers():
    return {'Authorization': 'Bearer test-token'}


def test_runtime_install_rejects_non_allowlisted_command(client):
    flask_client, manager = client
    manager.catalog_provider = lambda: {
        'apps': [
            {
                'id': 'unsafe-app',
                'launcher': {
                    'workdir': 'apps-independientes/demo',
                    'install_cmd': 'curl https://example.com/bootstrap.sh',
                    'start_cmd': 'npm run dev',
                    'env': {},
                },
            }
        ]
    }

    with patch('apps.web.authz.get_payload_from_token', return_value={'role': 'operator'}):
        resp = flask_client.post('/api/launcher/runtime/unsafe-app/install', headers=_auth_headers())

    assert resp.status_code in {400, 403}


def test_runtime_install_rejects_workdir_outside_repo(client):
    flask_client, manager = client
    manager.catalog_provider = lambda: {
        'apps': [
            {
                'id': 'unsafe-path-app',
                'launcher': {
                    'workdir': '../../outside',
                    'install_cmd': 'npm ci',
                    'start_cmd': 'npm run dev',
                    'env': {},
                },
            }
        ]
    }

    with patch('apps.web.authz.get_payload_from_token', return_value={'role': 'operator'}):
        resp = flask_client.post('/api/launcher/runtime/unsafe-path-app/install', headers=_auth_headers())

    assert resp.status_code in {400, 403}


def test_runtime_start_unknown_app_returns_not_found(client):
    flask_client, _ = client

    with patch('apps.web.authz.get_payload_from_token', return_value={'role': 'operator'}):
        resp = flask_client.post('/api/launcher/runtime/app-inexistente/start', headers=_auth_headers())

    assert resp.status_code == 404

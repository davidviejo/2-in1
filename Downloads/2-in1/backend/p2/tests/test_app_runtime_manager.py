from pathlib import Path

from apps.web import app_runtime_manager as manager


class FakeProcess:
    def __init__(self, pid=1234):
        self.pid = pid
        self._poll = None

    def poll(self):
        return self._poll


def test_start_managed_app_returns_error_for_missing_dir(monkeypatch):
    app_id = 'frontend-m3'
    original_spec = manager.MANAGED_APPS[app_id]
    monkeypatch.setitem(
        manager.MANAGED_APPS,
        app_id,
        manager.ManagedAppSpec(
            id=original_spec.id,
            name=original_spec.name,
            command=original_spec.command,
            cwd=Path('/tmp/path-that-does-not-exist-2in1'),
        ),
    )

    result = manager.start_managed_app(app_id)

    assert result['status'] == 'error'
    assert 'No existe el directorio de trabajo' in result['message']


def test_stop_managed_app_when_already_stopped():
    app_id = 'backend-p2'
    manager.APP_RUNTIME[app_id].process = None

    result = manager.stop_managed_app(app_id)

    assert result['status'] == 'already_stopped'
    assert result['app']['running'] is False


def test_start_managed_app_uses_popen(monkeypatch, tmp_path):
    app_id = 'local-seo-audit-poc'

    original_spec = manager.MANAGED_APPS[app_id]
    monkeypatch.setitem(
        manager.MANAGED_APPS,
        app_id,
        manager.ManagedAppSpec(
            id=original_spec.id,
            name=original_spec.name,
            command=original_spec.command,
            cwd=tmp_path,
        ),
    )

    fake_process = FakeProcess(pid=5678)

    def fake_popen(*args, **kwargs):
        return fake_process

    monkeypatch.setattr(manager.subprocess, 'Popen', fake_popen)

    result = manager.start_managed_app(app_id)

    assert result['status'] == 'started'
    assert result['app']['running'] is True
    assert result['app']['pid'] == 5678
    manager.APP_RUNTIME[app_id].process = None

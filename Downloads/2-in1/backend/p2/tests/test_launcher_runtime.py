from __future__ import annotations

import json
from pathlib import Path

import pytest

from apps.web.launcher_runtime import LauncherRuntimeConflictError, LauncherRuntimeError, LauncherRuntimeManager


class FakeProcess:
    def __init__(self, pid: int = 1234, exit_code: int = 0):
        self.pid = pid
        self._exit_code = exit_code

    def wait(self) -> int:
        return self._exit_code


class PopenSpy:
    def __init__(self, process: FakeProcess | None = None):
        self.calls: list[dict] = []
        self.process = process or FakeProcess()

    def __call__(self, cmd, **kwargs):
        self.calls.append({'cmd': cmd, **kwargs})
        return self.process


def _catalog(app_id: str = 'demo-app'):
    return {
        'apps': [
            {
                'id': app_id,
                'launcher': {
                    'workdir': 'apps-independientes/demo-app',
                    'install_cmd': 'npm ci',
                    'start_cmd': 'npm run dev',
                    'env': {'TEST_ENV': '1'},
                },
            }
        ]
    }


def test_start_stop_status_cycle_with_subprocess_mocks(tmp_path, monkeypatch):
    repo_root = tmp_path / 'repo'
    (repo_root / 'apps-independientes' / 'demo-app').mkdir(parents=True)

    popen_spy = PopenSpy(FakeProcess(pid=4321))
    manager = LauncherRuntimeManager(
        repo_root=repo_root,
        allowed_root=repo_root,
        catalog_provider=lambda: _catalog(),
        popen_factory=popen_spy,
    )

    killed: list[tuple[int, int]] = []

    def fake_kill(pid: int, sig: int):
        if sig == 0:
            if pid == 4321:
                return
            raise ProcessLookupError
        killed.append((pid, sig))

    monkeypatch.setattr('apps.web.launcher_runtime.os.kill', fake_kill)

    started = manager.start('demo-app')
    assert started['status'] == 'running'
    assert started['pid'] == 4321
    assert popen_spy.calls[0]['cmd'] == ['npm', 'run', 'dev']

    stopped = manager.stop('demo-app')
    assert stopped['status'] == 'stopped'
    assert stopped['pid'] is None
    assert killed == [(4321, 15)]

    state = json.loads((repo_root / 'var' / 'launcher_state.json').read_text(encoding='utf-8'))
    assert state['apps']['demo-app']['status'] == 'stopped'


def test_start_raises_conflict_if_already_running(tmp_path, monkeypatch):
    repo_root = tmp_path / 'repo'
    (repo_root / 'apps-independientes' / 'demo-app').mkdir(parents=True)

    manager = LauncherRuntimeManager(
        repo_root=repo_root,
        allowed_root=repo_root,
        catalog_provider=lambda: _catalog(),
        popen_factory=PopenSpy(FakeProcess(pid=777)),
    )

    monkeypatch.setattr('apps.web.launcher_runtime.os.kill', lambda pid, sig: None)

    manager.start('demo-app')
    with pytest.raises(LauncherRuntimeConflictError):
        manager.start('demo-app')


def test_stop_without_pid_marks_stopped_without_failing(tmp_path, monkeypatch):
    repo_root = tmp_path / 'repo'
    (repo_root / 'apps-independientes' / 'demo-app').mkdir(parents=True)

    manager = LauncherRuntimeManager(
        repo_root=repo_root,
        allowed_root=repo_root,
        catalog_provider=lambda: _catalog(),
        popen_factory=PopenSpy(),
    )

    manager._state['apps']['demo-app'] = {'status': 'running', 'pid': None}
    manager._persist_state()

    monkeypatch.setattr('apps.web.launcher_runtime.os.kill', lambda pid, sig: (_ for _ in ()).throw(AssertionError('os.kill should not be called')))

    result = manager.stop('demo-app')
    assert result['status'] == 'stopped'
    assert result['pid'] is None


def test_status_auto_heals_when_pid_not_found(tmp_path, monkeypatch):
    repo_root = tmp_path / 'repo'
    (repo_root / 'apps-independientes' / 'demo-app').mkdir(parents=True)

    manager = LauncherRuntimeManager(
        repo_root=repo_root,
        allowed_root=repo_root,
        catalog_provider=lambda: _catalog(),
        popen_factory=PopenSpy(),
    )
    manager._state['apps']['demo-app'] = {'status': 'running', 'pid': 9999}
    manager._persist_state()

    def fake_kill(pid: int, sig: int):
        raise ProcessLookupError

    monkeypatch.setattr('apps.web.launcher_runtime.os.kill', fake_kill)

    result = manager.status('demo-app')
    assert result['status'] == 'stopped'
    assert result['pid'] is None


def test_logs_returns_tail(tmp_path):
    repo_root = tmp_path / 'repo'
    (repo_root / 'apps-independientes' / 'demo-app').mkdir(parents=True)

    manager = LauncherRuntimeManager(
        repo_root=repo_root,
        allowed_root=repo_root,
        catalog_provider=lambda: _catalog(),
        popen_factory=PopenSpy(),
    )

    log_path = Path(repo_root / 'var' / 'launcher_logs' / 'demo-app.log')
    log_path.parent.mkdir(parents=True, exist_ok=True)
    log_path.write_text('l1\nl2\nl3\n', encoding='utf-8')

    assert manager.logs('demo-app', tail=2) == ['l2', 'l3']


def test_start_rejects_non_allowlisted_command(tmp_path):
    repo_root = tmp_path / 'repo'
    (repo_root / 'apps-independientes' / 'demo-app').mkdir(parents=True)
    manager = LauncherRuntimeManager(
        repo_root=repo_root,
        allowed_root=repo_root,
        catalog_provider=lambda: {
            'apps': [
                {
                    'id': 'demo-app',
                    'launcher': {
                        'workdir': 'apps-independientes/demo-app',
                        'install_cmd': 'curl -sS https://example.com/install.sh',
                        'start_cmd': 'npm run dev',
                        'env': {},
                    },
                }
            ]
        },
        popen_factory=PopenSpy(),
    )

    with pytest.raises(LauncherRuntimeError, match='Comando no permitido'):
        manager.install('demo-app')


def test_start_rejects_workdir_outside_allowed_root(tmp_path):
    repo_root = tmp_path / 'repo'
    (repo_root / 'apps-independientes' / 'demo-app').mkdir(parents=True)
    manager = LauncherRuntimeManager(
        repo_root=repo_root,
        allowed_root=repo_root / 'frontend',
        catalog_provider=lambda: _catalog(),
        popen_factory=PopenSpy(),
    )

    with pytest.raises(LauncherRuntimeError, match='fuera del root permitido'):
        manager.start('demo-app')


def test_logs_redacts_sensitive_pairs(tmp_path):
    repo_root = tmp_path / 'repo'
    (repo_root / 'apps-independientes' / 'demo-app').mkdir(parents=True)
    manager = LauncherRuntimeManager(
        repo_root=repo_root,
        allowed_root=repo_root,
        catalog_provider=lambda: _catalog(),
        popen_factory=PopenSpy(),
    )
    log_path = Path(repo_root / 'var' / 'launcher_logs' / 'demo-app.log')
    log_path.parent.mkdir(parents=True, exist_ok=True)
    log_path.write_text(
        'API_KEY=abcd1234\npassword:super-secret\ntoken = value123\nnormal_line\n',
        encoding='utf-8',
    )

    lines = manager.logs('demo-app', tail=10)
    assert lines[0] == 'API_KEY=[REDACTED]'
    assert lines[1] == 'password:[REDACTED]'
    assert lines[2] == 'token=[REDACTED]'
    assert lines[3] == 'normal_line'

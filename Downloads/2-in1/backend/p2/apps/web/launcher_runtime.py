from __future__ import annotations

import json
import os
import shlex
import signal
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from apps.web.launcher_catalog import get_launcher_catalog


class LauncherRuntimeError(Exception):
    """Base error for launcher runtime operations."""


class LauncherRuntimeConflictError(LauncherRuntimeError):
    """Raised when an app is already running."""

    status_code = 409


class LauncherRuntimeManager:
    def __init__(
        self,
        repo_root: Path | None = None,
        catalog_provider: Callable[[], dict[str, Any]] | None = None,
        popen_factory: Callable[..., Any] | None = None,
    ) -> None:
        self.repo_root = repo_root or Path(__file__).resolve().parents[3]
        self.var_dir = self.repo_root / 'var'
        self.logs_dir = self.var_dir / 'launcher_logs'
        self.state_file = self.var_dir / 'launcher_state.json'
        self.catalog_provider = catalog_provider or get_launcher_catalog
        self.popen_factory = popen_factory or subprocess.Popen

        self.logs_dir.mkdir(parents=True, exist_ok=True)
        self.var_dir.mkdir(parents=True, exist_ok=True)
        self._state = self._load_state()

    def install(self, app_id: str) -> dict[str, Any]:
        app = self._get_app(app_id)
        launcher = app['launcher']
        return self._run_blocking_command(
            app_id=app_id,
            workdir=launcher['workdir'],
            command=launcher['install_cmd'],
            env=launcher.get('env') or {},
            action='install',
        )

    def start(self, app_id: str) -> dict[str, Any]:
        app = self._get_app(app_id)
        launcher = app['launcher']

        if self._is_running(app_id):
            raise LauncherRuntimeConflictError(f'App {app_id} ya está en ejecución')

        command = self._to_command_args(launcher['start_cmd'])
        workdir = str((self.repo_root / launcher['workdir']).resolve())
        env = self._build_env(launcher.get('env') or {})
        log_path = self._log_path(app_id)

        with log_path.open('a', encoding='utf-8') as log_file:
            process = self.popen_factory(
                command,
                cwd=workdir,
                env=env,
                stdout=log_file,
                stderr=subprocess.STDOUT,
                shell=False,
            )

        self._state.setdefault('apps', {})[app_id] = {
            'status': 'running',
            'pid': process.pid,
            'workdir': launcher['workdir'],
            'started_at': self._utc_now(),
            'log_path': str(log_path),
        }
        self._persist_state()
        return self.status(app_id)

    def stop(self, app_id: str) -> dict[str, Any]:
        app_state = self._state.setdefault('apps', {}).get(app_id, {})
        pid = app_state.get('pid')

        if isinstance(pid, int):
            try:
                os.kill(pid, signal.SIGTERM)
            except ProcessLookupError:
                pass

        stopped_state = {
            **app_state,
            'status': 'stopped',
            'pid': None,
            'stopped_at': self._utc_now(),
        }
        self._state['apps'][app_id] = stopped_state
        self._persist_state()
        return self.status(app_id)

    def status(self, app_id: str) -> dict[str, Any]:
        app_state = self._state.setdefault('apps', {}).get(app_id)
        if not app_state:
            return {'app_id': app_id, 'status': 'stopped', 'pid': None}

        pid = app_state.get('pid')
        if isinstance(pid, int) and not self._pid_exists(pid):
            app_state = {
                **app_state,
                'status': 'stopped',
                'pid': None,
            }
            self._state['apps'][app_id] = app_state
            self._persist_state()

        return {
            'app_id': app_id,
            'status': app_state.get('status', 'stopped'),
            'pid': app_state.get('pid'),
            'started_at': app_state.get('started_at'),
            'stopped_at': app_state.get('stopped_at'),
        }

    def logs(self, app_id: str, tail: int = 200) -> list[str]:
        lines_limit = max(1, int(tail))
        log_path = self._log_path(app_id)
        if not log_path.exists():
            return []

        with log_path.open('r', encoding='utf-8', errors='replace') as fh:
            lines = fh.readlines()
        return [line.rstrip('\n') for line in lines[-lines_limit:]]

    def _run_blocking_command(
        self,
        app_id: str,
        workdir: str,
        command: str,
        env: dict[str, str],
        action: str,
    ) -> dict[str, Any]:
        log_path = self._log_path(app_id)
        cmd = self._to_command_args(command)
        with log_path.open('a', encoding='utf-8') as log_file:
            process = self.popen_factory(
                cmd,
                cwd=str((self.repo_root / workdir).resolve()),
                env=self._build_env(env),
                stdout=log_file,
                stderr=subprocess.STDOUT,
                shell=False,
            )
            exit_code = process.wait()

        result = {'app_id': app_id, 'action': action, 'exit_code': exit_code}
        self._state.setdefault('apps', {}).setdefault(app_id, {})['last_install'] = {
            'exit_code': exit_code,
            'updated_at': self._utc_now(),
        }
        self._persist_state()
        return result

    def _get_app(self, app_id: str) -> dict[str, Any]:
        catalog = self.catalog_provider()
        for app in catalog.get('apps', []):
            if app.get('id') == app_id:
                launcher = app.get('launcher')
                if not launcher:
                    raise LauncherRuntimeError(f'App {app_id} no tiene launcher configurado')
                return app
        raise LauncherRuntimeError(f'App {app_id} no encontrada')

    def _is_running(self, app_id: str) -> bool:
        state = self._state.setdefault('apps', {}).get(app_id)
        if not state:
            return False
        pid = state.get('pid')
        if not isinstance(pid, int):
            return False
        if self._pid_exists(pid):
            return state.get('status') == 'running'

        # Auto-healing state when PID no longer exists.
        self._state['apps'][app_id] = {**state, 'status': 'stopped', 'pid': None}
        self._persist_state()
        return False

    def _pid_exists(self, pid: int) -> bool:
        try:
            os.kill(pid, 0)
        except ProcessLookupError:
            return False
        except PermissionError:
            return True
        return True

    def _build_env(self, app_env: dict[str, str]) -> dict[str, str]:
        env = os.environ.copy()
        env.update(app_env)
        return env

    def _log_path(self, app_id: str) -> Path:
        return self.logs_dir / f'{app_id}.log'

    def _to_command_args(self, command: str) -> list[str]:
        return shlex.split(command)

    def _load_state(self) -> dict[str, Any]:
        if not self.state_file.exists():
            return {'apps': {}}

        try:
            raw = json.loads(self.state_file.read_text(encoding='utf-8'))
        except (json.JSONDecodeError, OSError):
            return {'apps': {}}

        if not isinstance(raw, dict):
            return {'apps': {}}
        apps = raw.get('apps')
        if not isinstance(apps, dict):
            raw['apps'] = {}
        return raw

    def _persist_state(self) -> None:
        self.state_file.write_text(
            json.dumps(self._state, ensure_ascii=False, indent=2, sort_keys=True),
            encoding='utf-8',
        )

    def _utc_now(self) -> str:
        return datetime.now(timezone.utc).isoformat()

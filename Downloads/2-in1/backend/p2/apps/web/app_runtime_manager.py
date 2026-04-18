from __future__ import annotations

import os
import signal
import subprocess
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List


@dataclass(frozen=True)
class ManagedAppSpec:
    id: str
    name: str
    command: List[str]
    cwd: Path


@dataclass
class ManagedAppRuntime:
    process: subprocess.Popen | None = None
    started_at: str | None = None
    last_error: str | None = None


REPO_ROOT = Path(__file__).resolve().parents[4]

MANAGED_APPS: Dict[str, ManagedAppSpec] = {
    'frontend-m3': ManagedAppSpec(
        id='frontend-m3',
        name='Frontend M3',
        command=['npm', 'run', 'dev', '--', '--host', '0.0.0.0', '--port', '5173'],
        cwd=REPO_ROOT / 'frontend' / 'm3',
    ),
    'backend-p2': ManagedAppSpec(
        id='backend-p2',
        name='Backend P2',
        command=['python', 'run.py'],
        cwd=REPO_ROOT / 'backend' / 'p2',
    ),
    'local-seo-audit-poc': ManagedAppSpec(
        id='local-seo-audit-poc',
        name='Local SEO Audit POC',
        command=['npm', 'run', 'dev', '--', '-p', '5174'],
        cwd=REPO_ROOT / 'apps-independientes' / 'local-seo-audit-poc',
    ),
}

APP_RUNTIME: Dict[str, ManagedAppRuntime] = {app_id: ManagedAppRuntime() for app_id in MANAGED_APPS}


def _runtime_snapshot(app_id: str) -> dict:
    spec = MANAGED_APPS[app_id]
    runtime = APP_RUNTIME[app_id]
    process = runtime.process
    running = bool(process and process.poll() is None)
    return {
        'id': app_id,
        'name': spec.name,
        'command': spec.command,
        'cwd': str(spec.cwd),
        'running': running,
        'pid': process.pid if running and process else None,
        'started_at': runtime.started_at,
        'last_error': runtime.last_error,
    }


def list_managed_apps() -> dict:
    return {'apps': [_runtime_snapshot(app_id) for app_id in MANAGED_APPS]}


def start_managed_app(app_id: str) -> dict:
    if app_id not in MANAGED_APPS:
        raise KeyError(app_id)

    spec = MANAGED_APPS[app_id]
    runtime = APP_RUNTIME[app_id]

    if runtime.process and runtime.process.poll() is None:
        return {
            'status': 'already_running',
            'app': _runtime_snapshot(app_id),
        }

    if not spec.cwd.exists():
        runtime.last_error = f'No existe el directorio de trabajo: {spec.cwd}'
        return {
            'status': 'error',
            'app': _runtime_snapshot(app_id),
            'message': runtime.last_error,
        }

    try:
        process = subprocess.Popen(
            spec.command,
            cwd=spec.cwd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            preexec_fn=os.setsid,
        )
    except Exception as exc:  # pragma: no cover
        runtime.last_error = str(exc)
        runtime.process = None
        return {
            'status': 'error',
            'app': _runtime_snapshot(app_id),
            'message': runtime.last_error,
        }

    runtime.process = process
    runtime.started_at = datetime.now(timezone.utc).isoformat()
    runtime.last_error = None

    return {
        'status': 'started',
        'app': _runtime_snapshot(app_id),
    }


def stop_managed_app(app_id: str) -> dict:
    if app_id not in MANAGED_APPS:
        raise KeyError(app_id)

    runtime = APP_RUNTIME[app_id]
    process = runtime.process

    if not process or process.poll() is not None:
        runtime.process = None
        return {
            'status': 'already_stopped',
            'app': _runtime_snapshot(app_id),
        }

    try:
        os.killpg(os.getpgid(process.pid), signal.SIGTERM)
    except ProcessLookupError:
        pass
    except Exception as exc:  # pragma: no cover
        runtime.last_error = str(exc)
        return {
            'status': 'error',
            'app': _runtime_snapshot(app_id),
            'message': runtime.last_error,
        }

    runtime.process = None
    return {
        'status': 'stopped',
        'app': _runtime_snapshot(app_id),
    }

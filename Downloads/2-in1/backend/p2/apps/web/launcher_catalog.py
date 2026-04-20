from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from flask import current_app


LauncherSection = str

MANIFEST_FILENAME = 'app.manifest.json'
VALID_SECTIONS: set[LauncherSection] = {'apps-integradas', 'frontend', 'backend'}
DEFAULT_STATUS = 'beta'
DEFAULT_ALLOWED_MANIFEST_ENV_VARS: set[str] = set()
LAUNCHER_IGNORE_FILENAME = '.launcherignore'


def _slugify(value: str) -> str:
    normalized = re.sub(r'[^a-zA-Z0-9]+', '-', value.strip().lower())
    return normalized.strip('-') or 'app'


def _title_from_slug(slug: str) -> str:
    return slug.replace('-', ' ').replace('_', ' ').title()


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[4]


def _default_runtime() -> dict[str, bool]:
    return {
        'enabled': True,
        'requires_credentials': False,
        'degraded': False,
    }


def _safe_text(value: Any) -> str:
    return str(value).strip() if isinstance(value, str) else ''


def _sanitize_workdir(value: Any, repo_root: Path) -> str:
    workdir = _safe_text(value)
    if not workdir:
        raise ValueError('Campo obligatorio inválido: workdir')

    workdir_path = Path(workdir)
    if workdir_path.is_absolute():
        raise ValueError('workdir debe ser una ruta relativa al repo')

    resolved = (repo_root / workdir_path).resolve()
    if repo_root.resolve() not in (resolved, *resolved.parents):
        raise ValueError('workdir no puede salir de la raíz del repositorio')

    return str(workdir_path)


def _sanitize_command(value: Any, field_name: str, required: bool) -> str | None:
    command = _safe_text(value)
    if required and not command:
        raise ValueError(f'Campo obligatorio inválido: {field_name}')
    if not required and not command:
        return None
    return command


def _sanitize_healthcheck(value: Any) -> dict[str, str] | None:
    if value is None:
        return None
    if not isinstance(value, dict):
        raise ValueError('healthcheck debe ser un objeto')

    check_type = _safe_text(value.get('type')).lower()
    target = _safe_text(value.get('target'))
    if check_type not in {'http', 'tcp'}:
        raise ValueError('healthcheck.type debe ser http o tcp')
    if not target:
        raise ValueError('healthcheck.target es obligatorio cuando hay healthcheck')

    if check_type == 'http':
        parsed = urlparse(target)
        if parsed.scheme not in {'http', 'https'} or not parsed.netloc:
            raise ValueError('healthcheck.target http debe ser una URL válida')
    else:
        if not re.fullmatch(r'[^:\s]+:\d{1,5}', target):
            raise ValueError('healthcheck.target tcp debe cumplir host:port')

    return {
        'type': check_type,
        'target': target,
    }


def _sanitize_env(value: Any, allowed_env_vars: set[str]) -> dict[str, str] | None:
    if value is None:
        return None
    if not isinstance(value, dict):
        raise ValueError('env debe ser un objeto key/value')

    sanitized: dict[str, str] = {}
    for key, raw in value.items():
        if not isinstance(key, str) or not isinstance(raw, str):
            raise ValueError('env solo admite pares string:string')
        key = key.strip()
        if key not in allowed_env_vars:
            raise ValueError(f'env contiene variable no permitida: {key}')
        sanitized[key] = raw

    return sanitized


def _sanitize_launcher(
    manifest: dict[str, Any],
    repo_root: Path,
    allowed_env_vars: set[str],
) -> dict[str, Any]:
    return {
        'workdir': _sanitize_workdir(manifest.get('workdir'), repo_root),
        'install_cmd': _sanitize_command(manifest.get('install_cmd'), 'install_cmd', required=True),
        'start_cmd': _sanitize_command(manifest.get('start_cmd'), 'start_cmd', required=True),
        'stop_cmd': _sanitize_command(manifest.get('stop_cmd'), 'stop_cmd', required=False),
        'healthcheck': _sanitize_healthcheck(manifest.get('healthcheck')),
        'env': _sanitize_env(manifest.get('env'), allowed_env_vars),
    }


def _sanitize_manifest(
    manifest: dict[str, Any],
    app_dir: Path,
    repo_root: Path,
    allowed_env_vars: set[str],
) -> dict[str, Any]:
    app_id = str(manifest.get('id') or f"integrada-{_slugify(app_dir.name)}")
    section = str(manifest.get('section') or 'apps-integradas')
    if section not in VALID_SECTIONS:
        section = 'apps-integradas'

    runtime = _default_runtime()
    runtime.update({
        'enabled': bool((manifest.get('runtime') or {}).get('enabled', True)),
        'requires_credentials': bool((manifest.get('runtime') or {}).get('requires_credentials', False)),
        'degraded': bool((manifest.get('runtime') or {}).get('degraded', False)),
    })

    app = {
        'id': app_id,
        'name': str(manifest.get('name') or _title_from_slug(app_dir.name)),
        'description': str(
            manifest.get('description')
            or 'App integrada registrada en apps-independientes.'
        ),
        'path': str(manifest.get('path') or ''),
        'section': section,
        'status': str(manifest.get('status') or DEFAULT_STATUS),
        'runtime': runtime,
        'source': {
            'kind': 'manifest',
            'manifest_path': str(app_dir / MANIFEST_FILENAME),
            'directory': str(app_dir),
        },
    }

    app['launcher'] = _sanitize_launcher(manifest, repo_root=repo_root, allowed_env_vars=allowed_env_vars)
    return app


def _fallback_app(app_dir: Path, reason: str | None = None) -> dict[str, Any]:
    app = {
        'id': f"integrada-{_slugify(app_dir.name)}",
        'name': _title_from_slug(app_dir.name),
        'description': 'App integrada detectada automáticamente. Añade app.manifest.json para activar el lanzador.',
        'path': '',
        'section': 'apps-integradas',
        'status': DEFAULT_STATUS,
        'runtime': {
            'enabled': False,
            'requires_credentials': False,
            'degraded': True,
        },
        'source': {
            'kind': 'filesystem',
            'directory': str(app_dir),
        },
    }
    if reason:
        app['runtime']['degraded_reason'] = reason
    return app


def _read_ignored_apps(base_dir: Path) -> set[str]:
    ignore_file = base_dir / LAUNCHER_IGNORE_FILENAME
    if not ignore_file.exists():
        return set()

    ignored: set[str] = set()
    for raw_line in ignore_file.read_text(encoding='utf-8').splitlines():
        line = raw_line.strip()
        if not line or line.startswith('#'):
            continue
        ignored.add(line)
    return ignored


def _load_integrated_apps(base_dir: Path, allowed_env_vars: set[str]) -> list[dict[str, Any]]:
    apps: list[dict[str, Any]] = []
    if not base_dir.exists() or not base_dir.is_dir():
        return apps

    repo_root = _repo_root()
    ignored_apps = _read_ignored_apps(base_dir)
    for app_dir in sorted((item for item in base_dir.iterdir() if item.is_dir()), key=lambda item: item.name.lower()):
        if app_dir.name in ignored_apps:
            continue
        manifest_path = app_dir / MANIFEST_FILENAME
        if not manifest_path.exists():
            apps.append(_fallback_app(app_dir))
            continue

        try:
            manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
            if not isinstance(manifest, dict):
                raise ValueError('manifest must be an object')
            apps.append(
                _sanitize_manifest(
                    manifest,
                    app_dir,
                    repo_root=repo_root,
                    allowed_env_vars=allowed_env_vars,
                )
            )
        except Exception as exc:
            reason = f'Manifest inválido: {exc}'
            app = _fallback_app(app_dir, reason=reason)
            app['description'] = f'{reason}. Corrige app.manifest.json para activar el lanzador.'
            apps.append(app)

    return apps


def get_launcher_catalog(app=None) -> dict[str, Any]:
    app = app or current_app
    repo_root = _repo_root()

    frontend_apps = [
        {
            'id': 'frontend-dashboard',
            'name': 'Frontend · Dashboard',
            'description': 'Entrada principal del panel de gestión SEO para clientes.',
            'path': '/app/',
            'section': 'frontend',
            'status': 'migrada',
            'runtime': _default_runtime(),
            'source': {'kind': 'static'},
            'launcher': {
                'workdir': 'frontend/m3',
                'install_cmd': 'npm install',
                'start_cmd': 'npm run dev -- --host 0.0.0.0 --port 5173',
                'stop_cmd': None,
                'healthcheck': {'type': 'http', 'target': 'http://localhost:5173'},
                'env': None,
            },
        },
        {
            'id': 'frontend-gsc-impact',
            'name': 'Frontend · Impacto GSC',
            'description': 'Vista de impacto por propiedad y portfolio en Search Console.',
            'path': '/app/gsc-impact?view=global',
            'section': 'frontend',
            'status': 'beta',
            'runtime': _default_runtime(),
            'source': {'kind': 'static'},
        },
        {
            'id': 'frontend-roadmap',
            'name': 'Frontend · Roadmap',
            'description': 'Planificación táctica y priorización de acciones por cliente.',
            'path': '/app/client-roadmap',
            'section': 'frontend',
            'status': 'migrada',
            'runtime': _default_runtime(),
            'source': {'kind': 'static'},
        },
    ]

    backend_apps = [
        {
            'id': 'backend-main',
            'name': 'Backend · API Principal',
            'description': 'Servicio Flask principal del workspace.',
            'path': '/global-status',
            'section': 'backend',
            'status': 'migrada',
            'runtime': _default_runtime(),
            'source': {'kind': 'static'},
            'launcher': {
                'workdir': 'backend/p2',
                'install_cmd': 'pip install -r requirements.txt',
                'start_cmd': 'python run.py',
                'stop_cmd': None,
                'healthcheck': {'type': 'http', 'target': 'http://localhost:5000/global-status'},
                'env': None,
            },
        },
        {
            'id': 'backend-operator',
            'name': 'Backend · Operator Console',
            'description': 'Consola para ejecución manual de operaciones internas.',
            'path': '/operator',
            'section': 'backend',
            'status': 'migrada',
            'runtime': {
                'enabled': True,
                'requires_credentials': True,
                'degraded': False,
            },
            'source': {'kind': 'static'},
        },
        {
            'id': 'backend-tools-catalog',
            'name': 'Backend · API Tools Catalog',
            'description': 'Endpoint JSON del catálogo de herramientas y estado runtime.',
            'path': '/api/tools/catalog',
            'section': 'backend',
            'status': 'beta',
            'runtime': _default_runtime(),
            'source': {'kind': 'static'},
        },
    ]

    integrated_apps_dir = repo_root / 'apps-independientes'
    allowed_env_vars = {
        item.strip()
        for item in app.config.get('LAUNCHER_ALLOWED_ENV_VARS', DEFAULT_ALLOWED_MANIFEST_ENV_VARS)
        if isinstance(item, str) and item.strip()
    }
    integrated_apps = _load_integrated_apps(integrated_apps_dir, allowed_env_vars=allowed_env_vars)

    apps = [*integrated_apps, *frontend_apps, *backend_apps]

    sections = [
        {
            'id': 'apps-integradas',
            'title': 'Apps integradas',
            'description': 'Apps alojadas en la carpeta apps-independientes y registradas con manifest.',
        },
        {
            'id': 'frontend',
            'title': 'Frontend',
            'description': 'Entradas rápidas a vistas clave del SPA.',
        },
        {
            'id': 'backend',
            'title': 'Backend',
            'description': 'Consolas y endpoints operativos del servidor.',
        },
    ]

    return {
        'sections': sections,
        'apps': apps,
        'meta': {
            'integrated_apps_root': str(integrated_apps_dir),
            'environment': app.config.get('ENV', 'production'),
        },
    }

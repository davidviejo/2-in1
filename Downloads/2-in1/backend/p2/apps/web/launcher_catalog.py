from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from flask import current_app


LauncherSection = str

MANIFEST_FILENAME = 'app.manifest.json'
VALID_SECTIONS: set[LauncherSection] = {'apps-integradas', 'frontend', 'backend'}
DEFAULT_STATUS = 'beta'


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


def _sanitize_manifest(manifest: dict[str, Any], app_dir: Path) -> dict[str, Any]:
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

    return {
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


def _fallback_app(app_dir: Path) -> dict[str, Any]:
    return {
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


def _load_integrated_apps(base_dir: Path) -> list[dict[str, Any]]:
    apps: list[dict[str, Any]] = []
    if not base_dir.exists() or not base_dir.is_dir():
        return apps

    for app_dir in sorted((item for item in base_dir.iterdir() if item.is_dir()), key=lambda item: item.name.lower()):
        manifest_path = app_dir / MANIFEST_FILENAME
        if not manifest_path.exists():
            apps.append(_fallback_app(app_dir))
            continue

        try:
            manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
            if not isinstance(manifest, dict):
                raise ValueError('manifest must be an object')
            apps.append(_sanitize_manifest(manifest, app_dir))
        except Exception:
            app = _fallback_app(app_dir)
            app['description'] = 'Manifest inválido. Corrige app.manifest.json para activar el lanzador.'
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
    integrated_apps = _load_integrated_apps(integrated_apps_dir)

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

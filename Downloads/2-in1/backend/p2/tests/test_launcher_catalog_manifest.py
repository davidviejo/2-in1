from __future__ import annotations

import json
from pathlib import Path

from apps.web.launcher_catalog import _load_integrated_apps, get_launcher_catalog


def _write_manifest(app_dir: Path, manifest: dict) -> None:
    (app_dir / 'app.manifest.json').write_text(json.dumps(manifest), encoding='utf-8')


def test_load_integrated_apps_accepts_manifest_with_launcher_fields(tmp_path, monkeypatch):
    repo_root = tmp_path / 'repo'
    base_dir = repo_root / 'apps-independientes'
    app_dir = base_dir / 'demo-app'
    app_dir.mkdir(parents=True)

    _write_manifest(
        app_dir,
        {
            'id': 'demo-app',
            'name': 'Demo App',
            'workdir': 'apps-independientes/demo-app',
            'install_cmd': 'npm ci',
            'start_cmd': 'npm run dev',
            'stop_cmd': 'pkill -f demo',
            'healthcheck': {'type': 'http', 'target': 'http://localhost:3000/health'},
            'env': {'SAFE_TOKEN': 'value'},
        },
    )

    monkeypatch.setattr('apps.web.launcher_catalog._repo_root', lambda: repo_root)

    apps = _load_integrated_apps(base_dir, allowed_env_vars={'SAFE_TOKEN'})
    assert len(apps) == 1
    launcher = apps[0]['launcher']
    assert launcher['workdir'] == 'apps-independientes/demo-app'
    assert launcher['install_cmd'] == 'npm ci'
    assert launcher['start_cmd'] == 'npm run dev'
    assert launcher['stop_cmd'] == 'pkill -f demo'
    assert launcher['healthcheck'] == {'type': 'http', 'target': 'http://localhost:3000/health'}
    assert launcher['env'] == {'SAFE_TOKEN': 'value'}


def test_load_integrated_apps_degrades_when_required_launcher_fields_missing(tmp_path, monkeypatch):
    repo_root = tmp_path / 'repo'
    base_dir = repo_root / 'apps-independientes'
    app_dir = base_dir / 'legacy-app'
    app_dir.mkdir(parents=True)

    _write_manifest(
        app_dir,
        {
            'id': 'legacy-app',
            'name': 'Legacy App',
            'path': 'http://localhost:3000',
        },
    )

    monkeypatch.setattr('apps.web.launcher_catalog._repo_root', lambda: repo_root)

    apps = _load_integrated_apps(base_dir, allowed_env_vars=set())
    assert len(apps) == 1
    degraded = apps[0]
    assert degraded['runtime']['degraded'] is True
    assert degraded['runtime']['enabled'] is False
    assert 'degraded_reason' in degraded['runtime']
    assert 'workdir' in degraded['runtime']['degraded_reason']


def test_load_integrated_apps_degrades_when_workdir_escapes_repo(tmp_path, monkeypatch):
    repo_root = tmp_path / 'repo'
    base_dir = repo_root / 'apps-independientes'
    app_dir = base_dir / 'bad-workdir'
    app_dir.mkdir(parents=True)

    _write_manifest(
        app_dir,
        {
            'id': 'bad-workdir',
            'workdir': '../outside',
            'install_cmd': 'npm ci',
            'start_cmd': 'npm run dev',
        },
    )

    monkeypatch.setattr('apps.web.launcher_catalog._repo_root', lambda: repo_root)

    apps = _load_integrated_apps(base_dir, allowed_env_vars=set())
    assert apps[0]['runtime']['degraded'] is True
    assert 'no puede salir' in apps[0]['runtime']['degraded_reason']


def test_load_integrated_apps_degrades_when_env_contains_disallowed_key(tmp_path, monkeypatch):
    repo_root = tmp_path / 'repo'
    base_dir = repo_root / 'apps-independientes'
    app_dir = base_dir / 'bad-env'
    app_dir.mkdir(parents=True)

    _write_manifest(
        app_dir,
        {
            'id': 'bad-env',
            'workdir': 'apps-independientes/bad-env',
            'install_cmd': 'npm ci',
            'start_cmd': 'npm run dev',
            'env': {'NOT_ALLOWED': 'x'},
        },
    )

    monkeypatch.setattr('apps.web.launcher_catalog._repo_root', lambda: repo_root)

    apps = _load_integrated_apps(base_dir, allowed_env_vars={'SAFE_TOKEN'})
    assert apps[0]['runtime']['degraded'] is True
    assert 'no permitida' in apps[0]['runtime']['degraded_reason']


def test_launcher_catalog_static_main_apps_include_launcher():
    class _FakeApp:
        config = {}

    catalog = get_launcher_catalog(app=_FakeApp())
    apps_by_id = {app['id']: app for app in catalog['apps']}

    assert apps_by_id['frontend-dashboard']['launcher']['workdir'] == 'frontend/m3'
    assert apps_by_id['frontend-dashboard']['launcher']['start_cmd'] == 'npm run dev -- --host 0.0.0.0 --port 5173'

    assert apps_by_id['backend-main']['launcher']['workdir'] == 'backend/p2'
    assert apps_by_id['backend-main']['launcher']['start_cmd'] == 'python run.py'


def test_load_integrated_apps_skips_directories_listed_in_launcherignore(tmp_path, monkeypatch):
    repo_root = tmp_path / 'repo'
    base_dir = repo_root / 'apps-independientes'
    skipped_dir = base_dir / 'tendencias-medios-main'
    app_dir = base_dir / 'demo-app'
    skipped_dir.mkdir(parents=True)
    app_dir.mkdir(parents=True)

    (base_dir / '.launcherignore').write_text('tendencias-medios-main\n', encoding='utf-8')
    _write_manifest(
        app_dir,
        {
            'id': 'demo-app',
            'workdir': 'apps-independientes/demo-app',
            'install_cmd': 'npm ci',
            'start_cmd': 'npm run dev',
        },
    )

    monkeypatch.setattr('apps.web.launcher_catalog._repo_root', lambda: repo_root)

    apps = _load_integrated_apps(base_dir, allowed_env_vars=set())
    assert len(apps) == 1
    assert apps[0]['id'] == 'demo-app'

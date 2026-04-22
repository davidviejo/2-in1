from flask import Flask
from pathlib import Path

from apps.web.blueprints.checklist_tool import checklist_bp
from apps.web.blueprints.checklist_tool import resolve_checklist_spa_url as resolve_legacy_checklist_url
from apps.web.blueprints.workflow_tool import resolve_checklist_spa_url as resolve_workflow_checklist_url


def test_resolve_checklist_url_defaults_to_integrated_hash_route(monkeypatch):
    monkeypatch.delenv('MEDIAFLOW_FRONTEND_URL', raising=False)

    assert resolve_legacy_checklist_url() == '/#/app/checklist'
    assert resolve_workflow_checklist_url() == '/#/app/checklist'


def test_resolve_checklist_url_uses_configured_frontend_base(monkeypatch):
    monkeypatch.setenv('MEDIAFLOW_FRONTEND_URL', 'http://localhost:5173')

    assert resolve_legacy_checklist_url() == 'http://localhost:5173/#/app/checklist'
    assert resolve_workflow_checklist_url() == 'http://localhost:5173/#/app/checklist'


def test_checklist_index_renders_legacy_page_without_redirect(monkeypatch):
    monkeypatch.delenv('MEDIAFLOW_FRONTEND_URL', raising=False)
    templates_dir = Path(__file__).resolve().parents[1] / 'templates'
    app = Flask(__name__, template_folder=str(templates_dir))
    app.register_blueprint(checklist_bp)

    response = app.test_client().get('/checklist')

    assert response.status_code == 200
    assert b'Checklist Legacy' in response.data
    assert b'#/app/checklist' in response.data


def test_checklist_bridge_redirects_to_spa_when_requested(monkeypatch):
    monkeypatch.setenv('MEDIAFLOW_FRONTEND_URL', 'http://localhost:5173')
    templates_dir = Path(__file__).resolve().parents[1] / 'templates'
    app = Flask(__name__, template_folder=str(templates_dir))
    app.register_blueprint(checklist_bp)

    response = app.test_client().get('/checklist/spa')

    assert response.status_code == 302
    assert response.headers['Location'] == 'http://localhost:5173/#/app/checklist'

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

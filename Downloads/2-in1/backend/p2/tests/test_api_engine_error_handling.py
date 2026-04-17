import requests

from apps.tools import scraper_core
from apps.web.blueprints.api_engine import routes as api_engine_routes


def test_checklist_evaluate_missing_credentials_returns_standardized_error(client, monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    response = client.post(
        "/api/ai/checklist-evaluate",
        json={
            "checks": [{"key": "meta_title", "status": "IMPROVE"}],
            "provider": "openai",
            "context": {"url": "https://example.com"},
        },
    )

    assert response.status_code == 400
    payload = response.get_json()
    assert payload["error"]["code"] == "missing_credentials"
    assert "API key" in payload["error"]["message"]
    assert "detail" not in payload["error"]


def test_checklist_evaluate_invalid_json_returns_standardized_error(client, monkeypatch):
    monkeypatch.setattr(api_engine_routes, "_run_checklist_ai_evaluation", lambda *args, **kwargs: "not-json")

    response = client.post(
        "/api/ai/checklist-evaluate",
        json={
            "checks": [{"key": "meta_title", "status": "IMPROVE"}],
            "provider": "openai",
            "apiKey": "test-key",
            "context": {"url": "https://example.com"},
        },
    )

    assert response.status_code == 422
    payload = response.get_json()
    assert payload["error"]["code"] == "invalid_ai_json"
    assert payload["error"]["detail"]


def test_fetch_url_read_timeout_returns_structured_error(monkeypatch):
    def _raise_timeout(*args, **kwargs):
        raise requests.exceptions.ReadTimeout("simulated timeout")

    monkeypatch.setattr(scraper_core.robust_session, "get", _raise_timeout)

    result = scraper_core.fetch_url("https://example.com", random_delay=False)

    assert result["ok"] is False
    assert result["error_type"] == "read_timeout"
    assert "simulated timeout" in result["error_message"]

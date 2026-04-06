from apps.web.blueprints.trends_economy import resolve_trends_media_frontend_url


def test_resolve_trends_media_frontend_url_defaults_to_integrated_hash_route(monkeypatch):
    monkeypatch.delenv('MEDIAFLOW_FRONTEND_URL', raising=False)

    assert resolve_trends_media_frontend_url() == '/#/app/trends-media'


def test_resolve_trends_media_frontend_url_uses_configured_frontend_base(monkeypatch):
    monkeypatch.setenv('MEDIAFLOW_FRONTEND_URL', 'http://localhost:5173')

    assert resolve_trends_media_frontend_url() == 'http://localhost:5173/#/app/trends-media'

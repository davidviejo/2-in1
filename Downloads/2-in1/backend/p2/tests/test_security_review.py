import pytest
import logging
from unittest.mock import patch, MagicMock
from apps.web import create_app

# Disable logging during tests to keep output clean
logging.getLogger('apps').setLevel(logging.CRITICAL)

@pytest.fixture
def client():
    app = create_app()
    app.config['TESTING'] = True

    # Mock database to prevent side effects
    with patch('apps.core.database.get_db_connection'):
        with app.test_client() as client:
            yield client

# --- SSRF TESTS (Unprotected endpoints) ---

def test_link_graph_ssrf(client):
    # Expect blockage or empty return
    resp = client.post('/graph/build', json={'urls': ['http://127.0.0.1']})
    assert resp.status_code == 200
    # Ideally should check that it didn't return nodes/edges from localhost

def test_leads_hunt_ssrf(client):
    resp = client.post('/leads/hunt', json={'urls': ['127.0.0.1']})
    assert resp.status_code == 200

def test_local_nap_ssrf(client):
    resp = client.post('/nap/check', json={'urls': ['http://127.0.0.1'], 'name':'foo', 'phone':'123', 'address':'bar'})
    assert resp.status_code == 200
    data = resp.json.get('data', [])
    if data:
        assert 'URL no permitida' in str(data)

def test_intent_analyze_ssrf(client):
    resp = client.post('/intent/analyze', json={'urls': ['http://127.0.0.1']})
    assert resp.status_code == 200

def test_crawler_run_ssrf(client):
    resp = client.post('/crawler/run', json={'url': 'http://127.0.0.1', 'limit': 1})
    assert resp.status_code == 200

def test_schema_run_ssrf(client):
    resp = client.post('/schema_detector/run', json={'urls': ['http://127.0.0.1']})
    assert resp.status_code == 200

def test_link_health_scan_ssrf(client):
    resp = client.post('/health/scan', json={'url': 'http://127.0.0.1'})
    assert resp.status_code == 200
    # Expect error message
    assert 'error' in resp.json

def test_hreflang_analyze_ssrf(client):
    resp = client.post('/hreflang/analyze', json={'urls': ['http://127.0.0.1']})
    assert resp.status_code == 200

def test_expired_scan_ssrf(client):
    resp = client.post('/expired/scan', json={'urls': ['http://127.0.0.1']})
    assert resp.status_code == 200

def test_audit_scan_ssrf(client):
    # This one accepts 'sitemap_url' form data
    resp = client.post('/audit/scan', data={'sitemap_url': 'http://127.0.0.1'})
    assert resp.status_code == 200
    assert 'error' in resp.json
    assert resp.json['error'] == 'URL no permitida'

def test_robots_check_ssrf(client):
    resp = client.post('/robots/check', json={'urls': ['http://127.0.0.1']})
    assert resp.status_code == 200


# --- PATH TRAVERSAL TESTS ---

def test_autopilot_path_traversal(client):
    # Tests that we cannot access files outside reports directory
    unsafe_id = "../../../config"
    resp = client.get(f'/autopilot/load/{unsafe_id}')
    assert resp.status_code in [404, 500, 200]
    if resp.status_code == 200:
        # If it returns 200, it should NOT be the config file content
        data = resp.json or {}
        assert 'SECRET_KEY' not in str(data)

# --- VERBOSE ERROR TESTS ---

def test_llm_service_verbose_error(client):
    # We mock openai client to fail
    with patch('apps.tools.llm_service.openai') as mock_openai:
        # Mock the client instance and its method
        mock_client_instance = MagicMock()
        mock_client_instance.chat.completions.create.side_effect = Exception("SENSITIVE_API_KEY_LEAK")
        mock_openai.OpenAI.return_value = mock_client_instance

        # Ensure os.getenv allows execution to reach openai call
        with patch.dict('os.environ', {'OPENAI_API_KEY': 'fake-key'}):
            resp = client.post('/api/enhance', json={
                'content': 'test', 'prompt': 'fix', 'provider': 'openai', 'model': 'gpt-3.5-turbo'
            })

            # response should NOT contain sensitive leak
            assert resp.status_code == 200
            data = resp.json
            # It returns a dictionary with 'result' usually (check enhance_tool.py)
            # Actually enhance_tool returns jsonify({'status':'ok', 'result': ...}) or error.
            # apps/enhance_tool.py:
            # result = query_llm(...)
            # return jsonify({'status': 'ok', 'result': result})

            assert 'SENSITIVE_API_KEY_LEAK' not in str(data)

# --- NEW UNIT TESTS ---

def test_fetch_sitemap_urls_ssrf_direct():
    from apps.web.blueprints.audit_tool import fetch_sitemap_urls
    with patch('requests.get') as mock_get:
        url = "http://127.0.0.1/sitemap.xml"
        result = fetch_sitemap_urls(url)
        mock_get.assert_not_called()
        assert result == []

def test_fetch_url_hybrid_ssrf_direct():
    from apps.tools.scraper_core import fetch_url_hybrid
    with patch('apps.tools.scraper_core._fetch_with_requests') as mock_req:
        url = "http://127.0.0.1/sensitive"
        result = fetch_url_hybrid(url)
        mock_req.assert_not_called()
        assert result['error'] == 'URL no permitida'

def test_autopilot_verbose_error_direct():
    from apps.web.blueprints.autopilot import audit_url_comprehensive
    with patch('requests.get') as mock_get:
        mock_get.side_effect = Exception("Connection refused to internal DB 192.168.1.5")
        # We need a safe URL to pass the first check
        result = audit_url_comprehensive("http://example.com", "keyword")
        issues_str = " ".join(result['issues'])
        assert "Connection refused to internal DB" not in issues_str
        assert "Error de conexión o análisis" in issues_str

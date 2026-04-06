import pytest
from unittest.mock import patch, MagicMock
from apps.web.blueprints.snippet_tool import analyze_snippet

def test_analyze_snippet_success():
    mock_html = """
    <html>
        <body>
            <h2>Que es Python?</h2>
            <p>Python es un lenguaje de programacion muy popular.</p>
        </body>
    </html>
    """
    with patch('apps.web.blueprints.snippet_tool.is_safe_url', return_value=True):
        with patch('requests.get') as mock_get:
            mock_resp = MagicMock()
            mock_resp.content = mock_html.encode('utf-8')
            mock_resp.status_code = 200
            mock_get.return_value = mock_resp

            result = analyze_snippet('http://example.com', 'Python')

            assert result['found'] is True
            assert result['text'] == "Python es un lenguaje de programacion muy popular."
            assert "Empieza definiendo" in result['msg']

def test_analyze_snippet_not_found():
    mock_html = "<html><body><h1>Hola Mundo</h1></body></html>"
    with patch('apps.web.blueprints.snippet_tool.is_safe_url', return_value=True):
        with patch('requests.get') as mock_get:
            mock_resp = MagicMock()
            mock_resp.content = mock_html.encode('utf-8')
            mock_get.return_value = mock_resp

            result = analyze_snippet('http://example.com', 'Java')
            assert result['found'] is False

def test_snippet_route(client):
    # Mocking is_safe_url to bypass DNS checks
    with patch('apps.web.blueprints.snippet_tool.is_safe_url', return_value=True):
        with patch('requests.get') as mock_get:
            mock_resp = MagicMock()
            mock_resp.content = b"<html><h2>Test KW</h2><p>Contenido de prueba.</p></html>"
            mock_get.return_value = mock_resp

            resp = client.post('/snippet/check', json={'url': 'http://test.com', 'keyword': 'Test KW'})
            assert resp.status_code == 200
            data = resp.get_json()
            assert data['status'] == 'ok'
            assert data['data']['found'] is True

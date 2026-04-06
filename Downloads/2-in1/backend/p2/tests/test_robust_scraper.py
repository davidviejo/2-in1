import pytest
from unittest.mock import patch, MagicMock
import requests
import time
from apps.tools.scraper_core import fetch_url, fetch_many, get_optimized_headers

class TestRobustScraper:

    @patch('apps.tools.scraper_core.robust_session.get')
    def test_fetch_url_ok(self, mock_get):
        # Configurar el mock para que devuelva una respuesta exitosa
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.url = 'http://example.com'
        mock_response.text = '<html><body>OK</body></html>'
        mock_get.return_value = mock_response

        # Ejecutar fetch_url sin random delay para acelerar el test
        result = fetch_url('http://example.com', random_delay=False)

        # Aserciones
        assert result['url'] == 'http://example.com'
        assert result['ok'] is True
        assert result['status_code'] == 200
        assert result['final_url'] == 'http://example.com'
        assert result['html'] == '<html><body>OK</body></html>'
        assert result['error_type'] is None
        assert result['error_message'] is None
        assert 'elapsed_ms' in result
        assert isinstance(result['elapsed_ms'], int)
        mock_get.assert_called_once()

    @patch('apps.tools.scraper_core.robust_session.get')
    def test_fetch_url_timeout(self, mock_get):
        # Simular un timeout de conexión
        mock_get.side_effect = requests.exceptions.ConnectTimeout("Connection timed out")

        result = fetch_url('http://example.com', random_delay=False)

        # Aserciones
        assert result['ok'] is False
        assert result['status_code'] is None
        assert result['error_type'] == 'connect_timeout'
        assert 'Connection timed out' in result['error_message']

    @patch('apps.tools.scraper_core.robust_session.get')
    def test_fetch_url_429_rate_limit(self, mock_get):
        # Simular un rate limit (429)
        mock_response = MagicMock()
        mock_response.status_code = 429
        mock_response.url = 'http://example.com'
        mock_get.return_value = mock_response

        result = fetch_url('http://example.com', random_delay=False)

        # Aserciones
        assert result['ok'] is False
        assert result['status_code'] == 429
        assert result['error_type'] == 'rate_limited_429'
        assert 'HTTP 429' in result['error_message']

    @patch('apps.tools.scraper_core.robust_session.get')
    def test_fetch_url_connection_error_dns(self, mock_get):
        # Simular error de conexión (DNS)
        mock_get.side_effect = requests.exceptions.ConnectionError("Failed to resolve Name resolution for example.com")

        result = fetch_url('http://example.com', random_delay=False)

        # Aserciones
        assert result['ok'] is False
        assert result['error_type'] == 'dns_error'
        assert 'Name resolution' in result['error_message']

    @patch('apps.tools.scraper_core.robust_session.get')
    def test_fetch_many_mixed_results(self, mock_get):
        # Mock para devolver 200 para URL1 y Timeout para URL2
        def side_effect(url, *args, **kwargs):
            if url == 'http://ok.com':
                mock_response = MagicMock()
                mock_response.status_code = 200
                mock_response.url = 'http://ok.com'
                mock_response.text = 'OK'
                return mock_response
            elif url == 'http://timeout.com':
                raise requests.exceptions.ReadTimeout("Read timed out")
            elif url == 'http://403.com':
                mock_response = MagicMock()
                mock_response.status_code = 403
                mock_response.url = 'http://403.com'
                return mock_response

        mock_get.side_effect = side_effect

        urls = ['http://ok.com', 'http://timeout.com', 'http://403.com']
        results = fetch_many(urls, random_delay=False, max_workers=3)

        # Aserciones de que los resultados vuelven en el mismo orden que las URLs
        assert len(results) == 3

        assert results[0]['url'] == 'http://ok.com'
        assert results[0]['ok'] is True
        assert results[0]['status_code'] == 200

        assert results[1]['url'] == 'http://timeout.com'
        assert results[1]['ok'] is False
        assert results[1]['error_type'] == 'read_timeout'

        assert results[2]['url'] == 'http://403.com'
        assert results[2]['ok'] is False
        assert results[2]['status_code'] == 403
        assert results[2]['error_type'] == 'blocked_403'

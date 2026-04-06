import unittest
from unittest.mock import patch, MagicMock
from apps.web.blueprints.content_gap import get_text_content
from apps.web.blueprints.meta_gen import gen
from apps.web.blueprints.image_audit import scan_imgs
from apps.web.blueprints.hreflang_tool import check_hreflang
from apps.tools.scraper_core import _fetch_with_requests, _fetch_with_playwright
from apps.web.blueprints.bot_sim import _fetch as bot_fetch, check as bot_check

class TestSecurityBasic(unittest.TestCase):

    def test_content_gap_ssrf(self):
        # Localhost should be blocked
        unsafe_url = "http://127.0.0.1/admin"
        result = get_text_content(unsafe_url)
        self.assertEqual(result, [], "Should return empty list for unsafe URL")

    def test_meta_gen_ssrf(self):
        unsafe_url = "http://127.0.0.1/admin"
        result = gen(unsafe_url, "{h1}", "{intro}")
        self.assertEqual(result['status'], "URL no permitida", "Should return status 'URL no permitida'")

    def test_image_audit_ssrf(self):
        unsafe_url = "http://127.0.0.1/admin"
        result = scan_imgs(unsafe_url)
        self.assertEqual(result.get('images'), [], "Should return empty images list")
        # Depending on implementation, it might check error key or just return empty
        # My implementation: return d (which has images=[]) if unsafe.

    def test_hreflang_error_suppression(self):
        with patch('apps.web.blueprints.hreflang_tool.requests.get') as mock_get:
            mock_get.side_effect = Exception("Internal DB Connection Failed")
            result = check_hreflang("http://example.com")
            self.assertEqual(result['error'], "Error procesando URL", "Should return generic error message")
            self.assertNotIn("Internal DB", str(result), "Should not leak internal error details")

    def test_scraper_core_requests_error_suppression(self):
        with patch('apps.tools.scraper_core.requests.get') as mock_get:
            mock_get.side_effect = Exception("System Path /etc/passwd leaked")
            result = _fetch_with_requests("http://example.com")
            self.assertEqual(result['error'], "Error de conexión", "Should return generic connection error")

    def test_scraper_core_playwright_error_suppression(self):
        with patch('apps.tools.scraper_core._run_async_playwright') as mock_browser:
            mock_browser.side_effect = Exception("Browser crash stack trace")
            result = _fetch_with_playwright("http://example.com")
            self.assertEqual(result['error'], "Error de navegación", "Should return generic navigation error")

    def test_bot_sim_error_suppression(self):
        with patch('apps.web.blueprints.bot_sim.session.get') as mock_get:
            # Need to import requests to raise the correct exception
            import requests
            mock_get.side_effect = requests.exceptions.RequestException("Sensitive data in exception")
            result = bot_fetch("http://example.com", "BotAgent")
            self.assertEqual(result['error'], "Error de conexión", "Should return generic error")

    def test_bot_sim_ssrf(self):
        unsafe_url = "http://127.0.0.1/admin"
        result = bot_check(unsafe_url)
        self.assertEqual(result['status'], "URL_NO_PERMITIDA", "Should return status 'URL_NO_PERMITIDA' for unsafe URL")

if __name__ == '__main__':
    unittest.main()

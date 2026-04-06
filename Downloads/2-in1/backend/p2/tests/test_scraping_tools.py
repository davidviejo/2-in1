import unittest
from unittest.mock import patch, MagicMock
from apps.web.blueprints.link_graph import get_links
from apps.web.blueprints.anchor_tool import scan
from apps.web.blueprints.headers_tool import analyze_headers

class TestScrapingTools(unittest.TestCase):

    # --- apps.link_graph.get_links ---
    @patch('apps.web.blueprints.link_graph.requests.get')
    @patch('apps.web.blueprints.link_graph.is_safe_url')
    def test_get_links_normal(self, mock_is_safe, mock_get):
        mock_is_safe.return_value = True
        mock_resp = MagicMock()
        mock_resp.content = b'''
        <html><body>
            <a href="/internal">Internal</a>
            <a href="http://example.com/internal2">Internal 2</a>
            <a href="http://google.com">External</a>
            <a href="#">Anchor</a>
        </body></html>
        '''
        mock_get.return_value = mock_resp

        # Domain matches example.com
        links = get_links("http://example.com/page", "example.com")

        # Check that we got internal links
        # Note: get_links returns a list of absolute URLs
        self.assertTrue(any("http://example.com/internal" in l for l in links))
        self.assertTrue(any("http://example.com/internal2" in l for l in links))
        # Ensure external is not there
        self.assertFalse(any("google.com" in l for l in links))

    @patch('apps.web.blueprints.link_graph.requests.get')
    @patch('apps.web.blueprints.link_graph.is_safe_url')
    def test_get_links_edge_error(self, mock_is_safe, mock_get):
        mock_is_safe.return_value = True
        mock_get.side_effect = Exception("Network")
        links = get_links("http://example.com", "example.com")
        self.assertEqual(links, [])

    # --- apps.anchor_tool.scan ---
    @patch('apps.web.blueprints.anchor_tool.requests.get')
    def test_scan_normal(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.content = b'''
        <html><body>
            <a href="http://example.com/p1">Click Here</a>
            <a href="/p2">Read More</a>
            <a href="http://other.com">Ignore</a>
        </body></html>
        '''
        mock_get.return_value = mock_resp

        results = scan("http://example.com", "example.com")

        # Expect 2 results (internal links)
        self.assertEqual(len(results), 2)
        texts = [r['text'] for r in results]
        self.assertIn("Click Here", texts)
        self.assertIn("Read More", texts)
        targets = [r['target'] for r in results]
        self.assertTrue(any("http://example.com/p1" in t for t in targets))

    @patch('apps.web.blueprints.anchor_tool.requests.get')
    def test_scan_edge_empty(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.content = b'<html></html>'
        mock_get.return_value = mock_resp
        results = scan("http://example.com", "example.com")
        self.assertEqual(results, [])

    # --- apps.headers_tool.analyze_headers ---
    @patch('apps.web.blueprints.headers_tool.requests.head')
    @patch('apps.web.blueprints.headers_tool.is_safe_url')
    def test_analyze_headers_normal_http(self, mock_is_safe, mock_head):
        mock_is_safe.return_value = True
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.headers = {'Content-Type': 'text/html', 'Server': 'TestServer'}
        mock_head.return_value = mock_resp

        data = analyze_headers("http://example.com")

        self.assertEqual(data['status'], 200)
        self.assertEqual(data['headers']['Server'], 'TestServer')
        # SSL should be empty for http
        self.assertEqual(data['ssl'], {})

    @patch('apps.web.blueprints.headers_tool.requests.head')
    @patch('apps.web.blueprints.headers_tool.is_safe_url')
    def test_analyze_headers_edge_error(self, mock_is_safe, mock_head):
        mock_is_safe.return_value = True
        mock_head.side_effect = Exception("Timeout")

        data = analyze_headers("http://example.com")

        self.assertEqual(data['status'], 'Error procesando URL')

if __name__ == '__main__':
    unittest.main()

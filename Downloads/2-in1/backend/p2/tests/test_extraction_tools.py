import unittest
from unittest.mock import patch, MagicMock
from apps.web.blueprints.structure_tool import get_struct
from apps.web.blueprints.hreflang_tool import check_hreflang
from apps.web.blueprints.schema_tool import extract

class TestExtractionTools(unittest.TestCase):

    # --- Tests for apps.structure_tool.get_struct ---
    @patch('apps.web.blueprints.structure_tool.requests.get')
    def test_get_struct_normal(self, mock_get):
        # Setup mock response
        mock_resp = MagicMock()
        mock_resp.content = b'<html><body><h1>Main Title</h1><h3>Subtitle</h3><p>Text</p></body></html>'
        mock_get.return_value = mock_resp

        # Call function
        result = get_struct("http://example.com")

        # Verify
        self.assertEqual(result['url'], "http://example.com")
        self.assertEqual(len(result['headers']), 2)
        # Check H1
        self.assertEqual(result['headers'][0]['tag'], 'H1')
        self.assertEqual(result['headers'][0]['txt'], 'Main Title')
        # Check H3
        self.assertEqual(result['headers'][1]['tag'], 'H3')
        self.assertEqual(result['headers'][1]['txt'], 'Subtitle')

    @patch('apps.web.blueprints.structure_tool.requests.get')
    def test_get_struct_edge_error(self, mock_get):
        # Setup mock to raise exception
        mock_get.side_effect = Exception("Connection Refused")

        # Call function
        result = get_struct("http://example.com")

        # Verify it handled exception gracefully (returned dict with empty headers)
        self.assertEqual(result['url'], "http://example.com")
        self.assertEqual(result['headers'], [])


    # --- Tests for apps.hreflang_tool.check_hreflang ---
    @patch('apps.web.blueprints.hreflang_tool.requests.get')
    def test_check_hreflang_normal(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.content = b'''
        <html><head>
            <link rel="alternate" hreflang="es" href="http://example.com/es" />
            <link rel="alternate" hreflang="x-default" href="http://example.com/" />
        </head></html>
        '''
        mock_get.return_value = mock_resp

        result = check_hreflang("http://example.com")

        self.assertEqual(len(result['tags']), 2)
        self.assertTrue(result['x_default'])
        self.assertIsNone(result['error'])

    @patch('apps.web.blueprints.hreflang_tool.requests.get')
    def test_check_hreflang_edge_error(self, mock_get):
        mock_get.side_effect = Exception("Timeout")

        result = check_hreflang("http://example.com")

        self.assertIsNotNone(result['error'])
        # Updated to expect generic error message for security
        self.assertEqual(result['error'], "Error procesando URL")


    # --- Tests for apps.schema_tool.extract ---
    @patch('apps.web.blueprints.schema_tool.requests.get')
    def test_schema_extract_normal(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.content = b'''
        <html><head>
            <script type="application/ld+json">
            {
                "@context": "https://schema.org",
                "@type": "Organization",
                "name": "MyOrg"
            }
            </script>
        </head></html>
        '''
        mock_get.return_value = mock_resp

        result = extract("http://example.com")

        self.assertEqual(result['status'], 200)
        self.assertIn("Organization", result['types'])
        self.assertEqual(len(result['raw']), 1)

    @patch('apps.web.blueprints.schema_tool.requests.get')
    def test_schema_extract_edge_invalid_json(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        # Invalid JSON
        mock_resp.content = b'''
        <html><head>
            <script type="application/ld+json">
            { "broken": "json"
            </script>
        </head></html>
        '''
        mock_get.return_value = mock_resp

        result = extract("http://example.com")

        self.assertEqual(result['status'], 200)
        # Should not crash, just empty types
        self.assertEqual(result['types'], [])

if __name__ == '__main__':
    unittest.main()

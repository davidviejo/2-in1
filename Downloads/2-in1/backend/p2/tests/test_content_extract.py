import unittest
from unittest.mock import patch, MagicMock
from apps.web.blueprints.content_extract import clean

class TestContentExtract(unittest.TestCase):

    @patch('apps.web.blueprints.content_extract.requests.get')
    @patch('apps.web.blueprints.content_extract.is_safe_url')
    def test_clean_normal(self, mock_is_safe, mock_get):
        mock_is_safe.return_value = True
        mock_resp = MagicMock()
        mock_resp.content = b'''
        <html><body>
            <h1>  Title  with   spaces  </h1>
            <p>Short</p>
            <p>This is a paragraph that is long enough to be included in the output.</p>
            <script>console.log('ignored')</script>
            <h2>  Subtitle that is long enough   </h2>
        </body></html>
        '''
        mock_get.return_value = mock_resp

        result = clean("http://example.com")

        self.assertEqual(result['url'], "http://example.com")
        self.assertIsNone(result['error'])

        # Verify whitespace normalization and filtering
        markdown = result['markdown']
        self.assertIn("# Title with spaces", markdown)
        self.assertIn("## Subtitle that is long enough", markdown)
        self.assertIn("This is a paragraph that is long enough to be included in the output.", markdown)

        # Short text should be excluded
        self.assertNotIn("Short", markdown)

        # Script should be excluded
        self.assertNotIn("console.log", markdown)

    @patch('apps.web.blueprints.content_extract.requests.get')
    @patch('apps.web.blueprints.content_extract.is_safe_url')
    def test_clean_unsafe_url(self, mock_is_safe, mock_get):
        mock_is_safe.return_value = False

        result = clean("http://unsafe.com")

        self.assertEqual(result['error'], "URL no permitida")
        self.assertEqual(result['markdown'], "")

    @patch('apps.web.blueprints.content_extract.requests.get')
    @patch('apps.web.blueprints.content_extract.is_safe_url')
    def test_clean_error(self, mock_is_safe, mock_get):
        mock_is_safe.return_value = True
        mock_get.side_effect = Exception("Network Error")

        result = clean("http://example.com")

        self.assertEqual(result['error'], "Error procesando el contenido")

if __name__ == '__main__':
    unittest.main()

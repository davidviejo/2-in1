import unittest
from unittest.mock import patch, MagicMock
from apps.tools.scraper_core import search_google_official, GoogleAPIError

class TestGoogleAPIError(unittest.TestCase):
    @patch('requests.get')
    def test_search_google_official_raises_error(self, mock_get):
        # Mock response with error
        mock_response = MagicMock()
        mock_response.status_code = 403 # Explicitly set status code
        mock_response.json.return_value = {
            "error": {
                "message": "This project does not have the access to Custom Search JSON API.",
            }
        }
        mock_get.return_value = mock_response

        # New behavior: raises GoogleAPIError when raise_on_error=True
        with self.assertRaises(GoogleAPIError) as cm:
            search_google_official("test", "key", "cx", raise_on_error=True)

        self.assertEqual(str(cm.exception), "Error: El proyecto de Google Cloud no tiene habilitada la API 'Custom Search JSON API'. Por favor habilítala en la consola de Google Cloud.")

    @patch('requests.get')
    def test_search_google_official_swallows_error_by_default(self, mock_get):
        # Mock response with error
        mock_response = MagicMock()
        mock_response.status_code = 403 # Explicitly set status code
        mock_response.json.return_value = {
            "error": {
                "message": "This project does not have the access to Custom Search JSON API.",
            }
        }
        mock_get.return_value = mock_response

        # Default behavior: returns empty list
        results = search_google_official("test", "key", "cx", raise_on_error=False)
        self.assertEqual(results, [])

if __name__ == '__main__':
    unittest.main()

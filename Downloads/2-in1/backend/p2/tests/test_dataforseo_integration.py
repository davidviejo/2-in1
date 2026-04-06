import unittest
from unittest.mock import patch, MagicMock
import sys
import os

# Mock dependencies (Deep mocking)
sys.modules['flask'] = MagicMock()
sys.modules['werkzeug'] = MagicMock()
sys.modules['werkzeug.utils'] = MagicMock()
sys.modules['apps.usage_tracker'] = MagicMock()
sys.modules['pandas'] = MagicMock()
sys.modules['duckduckgo_search'] = MagicMock()
sys.modules['playwright'] = MagicMock()
sys.modules['playwright.sync_api'] = MagicMock()
sys.modules['requests'] = MagicMock()
sys.modules['bs4'] = MagicMock()
sys.modules['google.oauth2.credentials'] = MagicMock()
sys.modules['google_auth_oauthlib.flow'] = MagicMock()
sys.modules['spacy'] = MagicMock()
sys.modules['openai'] = MagicMock()
sys.modules['anthropic'] = MagicMock()
sys.modules['google.generativeai'] = MagicMock()

# Ensure apps module can be imported
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Import AFTER mocking
from apps.tools.scraper_core import smart_serp_search
from apps.core.config import Config

class TestDataForSEOIntegration(unittest.TestCase):

    def setUp(self):
        self.mock_post_patcher = patch('apps.tools.scraper_core.requests.post')
        self.mock_post = self.mock_post_patcher.start()

        self.mock_google_patcher = patch('apps.tools.scraper_core.search_google_official')
        self.mock_google = self.mock_google_patcher.start()

    def tearDown(self):
        self.mock_post_patcher.stop()
        self.mock_google_patcher.stop()

    @patch('apps.core.config.Config.DATAFORSEO_LOGIN', 'test_user')
    @patch('apps.core.config.Config.DATAFORSEO_PASSWORD', 'test_pass')
    def test_smart_serp_search_uses_dataforseo_auto(self):
        # Mock DataForSEO response
        mock_response = MagicMock()
        mock_response.json.return_value = {
            'status_code': 20000,
            'tasks': [
                {
                    'result': [
                        {
                            'items': [
                                {
                                    'type': 'organic',
                                    'url': 'https://example.com',
                                    'title': 'Example Title',
                                    'description': 'Example Snippet',
                                    'rank_group': 1
                                }
                            ]
                        }
                    ]
                }
            ]
        }
        self.mock_post.return_value = mock_response

        # Call smart_serp_search with implicit mode (auto)
        results = smart_serp_search("test keyword", config={})

        # Verify requests.post was called with correct URL and auth
        args, kwargs = self.mock_post.call_args
        self.assertEqual(args[0], "https://api.dataforseo.com/v3/serp/google/organic/live/advanced")

        # Verify result parsing
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['url'], 'https://example.com')
        self.assertEqual(results[0]['title'], 'Example Title')

    @patch('apps.core.config.Config.DATAFORSEO_LOGIN', 'test_user')
    @patch('apps.core.config.Config.DATAFORSEO_PASSWORD', 'test_pass')
    def test_smart_serp_search_explicit_mode(self):
        # Mock DataForSEO response
        mock_response = MagicMock()
        mock_response.json.return_value = {
            'status_code': 20000,
            'tasks': [{'result': [{'items': []}]}]
        }
        self.mock_post.return_value = mock_response

        # Call with explicit mode
        smart_serp_search("test", config={'mode': 'dataforseo'})

        self.mock_post.assert_called_once()

    def test_smart_serp_search_fallback_google(self):
        # Ensure DFS creds are None for this test via patching Config inside the context manager
        with patch('apps.core.config.Config.DATAFORSEO_LOGIN', None):
            smart_serp_search("test", config={'mode': 'google_api_official', 'cse_key': 'k', 'cse_cx': 'c'})
            self.mock_google.assert_called_once()

if __name__ == '__main__':
    unittest.main()

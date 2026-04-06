
import unittest
from unittest.mock import MagicMock
import sys
import os
import json

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Mock dependencies
sys.modules['flask'] = MagicMock()
sys.modules['pandas'] = MagicMock()
sys.modules['werkzeug'] = MagicMock()
sys.modules['werkzeug.utils'] = MagicMock()
sys.modules['apps.usage_tracker'] = MagicMock()
sys.modules['playwright'] = MagicMock()
sys.modules['playwright.sync_api'] = MagicMock()
sys.modules['requests'] = MagicMock()
sys.modules['duckduckgo_search'] = MagicMock()
sys.modules['bs4'] = MagicMock()
sys.modules['google.oauth2.credentials'] = MagicMock()
sys.modules['google_auth_oauthlib.flow'] = MagicMock()
sys.modules['spacy'] = MagicMock()
sys.modules['openai'] = MagicMock()
sys.modules['anthropic'] = MagicMock()
sys.modules['google.generativeai'] = MagicMock()
sys.modules['openpyxl'] = MagicMock()
sys.modules['lxml'] = MagicMock()

# Import the function to test
try:
    from apps.tools.scraper_core import search_dataforseo
    import apps.tools.scraper_core
except ImportError as e:
    print(f"ImportError: {e}")
    sys.exit(1)

class TestDataForSEOFix(unittest.TestCase):
    def test_search_dataforseo_keyword_not_base64_encoded(self):
        # Mock requests.post
        mock_post = MagicMock()
        apps.tools.scraper_core.requests.post = mock_post

        # Mock response
        mock_response = MagicMock()
        mock_response.json.return_value = {'status_code': 20000, 'tasks': []}
        mock_post.return_value = mock_response

        keyword = "test keyword"
        search_dataforseo(keyword, "login", "pass")

        # Verify call
        args, kwargs = mock_post.call_args
        payload = kwargs.get('json')

        self.assertIsNotNone(payload, "Payload should be present")
        self.assertEqual(len(payload), 1, "Payload should be a list with one item")
        # This assertion is expected to fail initially
        self.assertEqual(payload[0]['keyword'], keyword, f"Keyword '{payload[0]['keyword']}' should be '{keyword}' (plain string, not base64 encoded)")

if __name__ == '__main__':
    unittest.main()

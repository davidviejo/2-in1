
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
sys.modules['playwright.async_api'] = MagicMock()
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

    def test_standard_flow_uses_tasks_ready_before_task_get(self):
        mock_post = MagicMock()
        mock_get = MagicMock()
        apps.tools.scraper_core.requests.post = mock_post
        apps.tools.scraper_core.requests.get = mock_get

        post_response = MagicMock()
        post_response.json.return_value = {
            'status_code': 20000,
            'tasks': [{'id': 'task-123'}]
        }
        mock_post.return_value = post_response

        tasks_ready_response = MagicMock()
        tasks_ready_response.json.return_value = {
            'status_code': 20000,
            'tasks': [{'result': [{'id': 'task-123'}]}]
        }
        task_get_response = MagicMock()
        task_get_response.json.return_value = {
            'status_code': 20000,
            'tasks': [{
                'cost': 0.001,
                'result': [{'items': [{
                    'type': 'organic',
                    'url': 'https://example.com',
                    'title': 'Example',
                    'description': 'Snippet',
                    'rank_group': 1
                }]}]
            }]
        }
        mock_get.side_effect = [tasks_ready_response, task_get_response]

        results = search_dataforseo(
            "test keyword",
            "login",
            "pass",
            execution_mode='standard',
            poll_attempts=1
        )

        self.assertEqual(len(results), 1)
        self.assertEqual(mock_get.call_count, 2)
        first_call_url = mock_get.call_args_list[0][0][0]
        second_call_url = mock_get.call_args_list[1][0][0]
        self.assertIn("/tasks_ready", first_call_url)
        self.assertIn("/task_get/regular/task-123", second_call_url)

if __name__ == '__main__':
    unittest.main()

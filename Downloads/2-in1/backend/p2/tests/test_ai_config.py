import unittest
from flask import Flask, session
from apps.web.blueprints.ai_routes import ai_bp
from apps.tools.scraper_core import smart_serp_search
import os

class TestAIConfig(unittest.TestCase):
    def setUp(self):
        # Point to the correct templates folder relative to tests/
        template_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../templates'))
        self.app = Flask(__name__, template_folder=template_dir)
        self.app.secret_key = 'test'
        self.app.register_blueprint(ai_bp)
        self.client = self.app.test_client()

    def test_dashboard_config_passing(self):
        with self.client.session_transaction() as sess:
            sess['openai_key'] = 'sk-test-123'
            sess['dataforseo_login'] = 'user'

        response = self.client.get('/ai/dashboard')
        self.assertEqual(response.status_code, 200)
        # Check if config values are in the rendered template context
        # Since we can't easily check template context in unittest without capturing templates,
        # we'll check if the value appears in the HTML (which I put in input values).
        self.assertIn(b'value="sk-test-123"', response.data)
        self.assertIn(b'value="user"', response.data)

    def test_set_preference_global_keys(self):
        payload = {
            'openai_key': 'sk-new-key',
            'memory_context_window': 'long',
            'high_privacy': True
        }
        response = self.client.post('/ai/preference', json=payload)
        self.assertEqual(response.status_code, 200)

        with self.client.session_transaction() as sess:
            self.assertEqual(sess['openai_key'], 'sk-new-key')
            self.assertEqual(sess['memory_context_window'], 'long')
            self.assertEqual(sess['ai_high_privacy'], True)

    def test_scraper_core_session_injection(self):
        # Test that smart_serp_search picks up session values
        with self.app.test_request_context():
            session['dataforseo_login'] = 'session-login'
            session['dataforseo_pass'] = 'session-pass'

            # Mocking config to capture what smart_serp_search prepares
            # Wait, smart_serp_search calls search_dataforseo internally.
            # I can mock search_dataforseo to verify arguments.

            from unittest.mock import patch
            with patch('apps.tools.scraper_core.search_dataforseo') as mock_search:
                mock_search.return_value = []

                # Call with mode='dataforseo' to force DFS path
                smart_serp_search('test', config={'mode': 'dataforseo'})

                mock_search.assert_called_with(
                    'test', 'session-login', 'session-pass', 10, 'es', 'es'
                )

if __name__ == '__main__':
    unittest.main()

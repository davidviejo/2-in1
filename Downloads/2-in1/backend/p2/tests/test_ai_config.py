import unittest
from flask import Flask, session
from apps.web.blueprints.ai_routes import ai_bp
from apps.tools.scraper_core import smart_serp_search
import os
import tempfile
from unittest.mock import patch
import apps.core.database as database

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
                    'test',
                    'session-login',
                    'session-pass',
                    10,
                    'es',
                    'es',
                    detail='regular',
                    execution_mode='standard',
                    return_metadata=True,
                )


    def test_settings_config_api_roundtrip(self):
        payload = {
            'openaiApiKey': 'sk-server-123',
            'openaiModel': 'gpt-4o',
            'dataforseoLogin': 'dfs-user',
            'dataforseoPassword': 'dfs-pass',
            'serpApiKey': 'serp-key',
            'defaultSerpProvider': 'serpapi'
        }

        store = {}

        def fake_get_user_settings(_user_id):
            return store.copy()

        def fake_upsert_user_settings(_user_id, updates):
            store.update(updates)

        with patch('apps.web.authz.get_payload_from_token', return_value={'role': 'operator'}), \
             patch('apps.web.blueprints.ai_routes.get_user_settings', side_effect=fake_get_user_settings), \
             patch('apps.web.blueprints.ai_routes.upsert_user_settings', side_effect=fake_upsert_user_settings):
            put_response = self.client.put(
                '/api/settings/config',
                json=payload,
                headers={'Authorization': 'Bearer test-token'},
            )
            self.assertEqual(put_response.status_code, 200)

            get_response = self.client.get(
                '/api/settings/config',
                headers={'Authorization': 'Bearer test-token'},
            )
            self.assertEqual(get_response.status_code, 200)
            body = get_response.get_json()
            self.assertEqual(body['settings']['openaiApiKey']['configured'], True)
            self.assertNotEqual(body['settings']['openaiApiKey']['maskedValue'], 'sk-server-123')
            self.assertEqual(body['settings']['defaultSerpProvider'], 'serpapi')

    def test_settings_config_api_validation(self):
        bad_payload = {'defaultSerpProvider': 'invalid-provider'}
        with patch('apps.web.authz.get_payload_from_token', return_value={'role': 'operator'}):
            response = self.client.put(
                '/api/settings/config',
                json=bad_payload,
                headers={'Authorization': 'Bearer test-token'},
            )
            self.assertEqual(response.status_code, 400)

    def test_settings_config_api_requires_auth_header(self):
        response = self.client.get('/api/settings/config')
        self.assertEqual(response.status_code, 401)

    def test_settings_config_api_forbidden_for_non_operator(self):
        with patch('apps.web.authz.get_payload_from_token', return_value={'role': 'clients_area'}):
            response = self.client.get('/api/settings/config', headers={'Authorization': 'Bearer test-token'})
            self.assertEqual(response.status_code, 403)

    def test_settings_config_api_persists_encrypted_secrets_in_database(self):
        db_fd, db_path = tempfile.mkstemp()
        original_db_file = database.DB_FILE
        original_key = os.environ.get('SETTINGS_ENCRYPTION_KEY')

        try:
            os.environ['SETTINGS_ENCRYPTION_KEY'] = 'test-settings-key-ai-config'
            database.DB_FILE = db_path
            database.get_user_settings.cache_clear()
            database._get_settings_cipher.cache_clear()
            database.init_db()

            payload = {
                'openaiApiKey': 'sk-server-123',
                'dataforseoPassword': 'dfs-pass',
                'serpApiKey': 'serp-key',
                'defaultSerpProvider': 'serpapi',
            }

            with patch('apps.web.authz.get_payload_from_token', return_value={'role': 'operator'}):
                put_response = self.client.put(
                    '/api/settings/config',
                    json=payload,
                    headers={'Authorization': 'Bearer test-token'},
                )
                self.assertEqual(put_response.status_code, 200)

                get_response = self.client.get(
                    '/api/settings/config',
                    headers={'Authorization': 'Bearer test-token'},
                )
                self.assertEqual(get_response.status_code, 200)
                body = get_response.get_json()
                self.assertEqual(body['settings']['openaiApiKey']['configured'], True)
                self.assertEqual(body['settings']['defaultSerpProvider'], 'serpapi')

            conn = database.get_db_connection()
            try:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT openai_key, dataforseo_password, serpapi_key FROM user_settings WHERE user_id = ?",
                    ('default',),
                )
                row = cursor.fetchone()
            finally:
                conn.close()

            self.assertTrue(row['openai_key'].startswith(database.ENCRYPTED_VALUE_PREFIX))
            self.assertTrue(row['dataforseo_password'].startswith(database.ENCRYPTED_VALUE_PREFIX))
            self.assertTrue(row['serpapi_key'].startswith(database.ENCRYPTED_VALUE_PREFIX))
        finally:
            database.DB_FILE = original_db_file
            database.get_user_settings.cache_clear()
            database._get_settings_cipher.cache_clear()
            os.close(db_fd)
            if os.path.exists(db_path):
                os.remove(db_path)
            if original_key is None:
                os.environ.pop('SETTINGS_ENCRYPTION_KEY', None)
            else:
                os.environ['SETTINGS_ENCRYPTION_KEY'] = original_key

if __name__ == '__main__':
    unittest.main()

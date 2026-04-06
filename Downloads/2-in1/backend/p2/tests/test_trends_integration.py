import unittest
import sys
from unittest.mock import patch, MagicMock
import json

# Mock dependencies
sys.modules['flask'] = MagicMock()
sys.modules['apps.core.database'] = MagicMock()

# Load module manually to avoid apps/__init__.py
import importlib.util
# Mock more deps that apps/__init__ might trigger if we fail to bypass it properly
sys.modules['pandas'] = MagicMock()
sys.modules['spacy'] = MagicMock()
sys.modules['requests'] = MagicMock()
sys.modules['bs4'] = MagicMock()
sys.modules['werkzeug'] = MagicMock()
sys.modules['werkzeug.utils'] = MagicMock()

import os
# Now load trends_economy
basedir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
target_path = os.path.join(basedir, "apps", "web", "blueprints", "trends_economy.py")
spec = importlib.util.spec_from_file_location("apps.web.blueprints.trends_economy", target_path)
trends_economy = importlib.util.module_from_spec(spec)
sys.modules["apps.web.blueprints.trends_economy"] = trends_economy
spec.loader.exec_module(trends_economy)

worker_realtime_trends = trends_economy.worker_realtime_trends

class TestTrendsIntegration(unittest.TestCase):

    @patch('apps.web.blueprints.trends_economy.sqlite3.connect')
    @patch('apps.web.blueprints.trends_economy.fetch_trends_strategy')
    def test_worker_uses_api_key(self, mock_fetch, mock_connect):
        # Mock DB
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_connect.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cursor

        # Mock fetchone to return a valid job row (id, active, progress, log, data, error)
        # log is json string "[]"
        mock_cursor.fetchone.return_value = ('job1', 1, 0, '[]', '[]', None)

        # Mock fetch result
        mock_fetch.return_value = [{"rank": 1, "topic": "Test", "traffic": "100", "context": "C", "google_link": "L"}]

        worker_realtime_trends("job1", "ES", "h", api_key="valid_key_12345")

        # Verify Strategy Call
        # Note: geo is stripped and uppercased in worker -> "ES"
        mock_fetch.assert_called_with("ES", "h", provider_name="serpapi", api_key="valid_key_12345")

        # Verify DB Updates (active=0 at end)
        self.assertTrue(mock_cursor.execute.called)

    @patch('apps.web.blueprints.trends_economy.sqlite3.connect')
    @patch('apps.web.blueprints.trends_economy.fetch_trends_strategy')
    @patch('apps.web.blueprints.trends_economy.get_user_settings')
    @patch('apps.web.blueprints.trends_economy.os.getenv')
    def test_worker_uses_dataforseo_env(self, mock_getenv, mock_settings, mock_fetch, mock_connect):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_connect.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cursor
        mock_cursor.fetchone.return_value = ('job2', 1, 0, '[]', '[]', None)

        mock_fetch.return_value = [{"rank": 1, "topic": "DFS", "traffic": "100", "context": "C", "google_link": "L"}]

        # Setup Env
        def getenv_side_effect(key, default=None):
            if key == 'TRENDS_PROVIDER': return 'dataforseo'
            if key == 'DATAFORSEO_LOGIN': return 'env_login'
            if key == 'DATAFORSEO_PASSWORD': return 'env_pass'
            return default
        mock_getenv.side_effect = getenv_side_effect
        mock_settings.return_value = {}

        worker_realtime_trends("job2", "US", "b")

        mock_fetch.assert_called_with("US", "b", provider_name="dataforseo", login="env_login", password="env_pass")

    @patch('apps.web.blueprints.trends_economy.sqlite3.connect')
    @patch('apps.web.blueprints.trends_economy.fetch_trends_strategy')
    @patch('apps.web.blueprints.trends_economy.get_user_settings')
    @patch('apps.web.blueprints.trends_economy.os.getenv')
    def test_worker_uses_internal_fallback(self, mock_getenv, mock_settings, mock_fetch, mock_connect):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_connect.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cursor
        mock_cursor.fetchone.return_value = ('job3', 1, 0, '[]', '[]', None)

        mock_fetch.return_value = [{"rank": 1, "topic": "Internal", "traffic": "100", "context": "C", "google_link": "L"}]

        # Fix mock_getenv to handle default
        def getenv_side_effect(key, default=None):
            return default
        mock_getenv.side_effect = getenv_side_effect

        mock_settings.return_value = {} # No settings

        worker_realtime_trends("job3", "MX", "t")

        # Fallback directo al proveedor interno si DataForSEO no está disponible
        mock_fetch.assert_called_with("MX", "t", provider_name="internal")

if __name__ == '__main__':
    unittest.main()

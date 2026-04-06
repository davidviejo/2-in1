import unittest
import os
import sys
from unittest.mock import MagicMock, patch
import bcrypt

# Append path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Mock modules
sys.modules['pandas'] = MagicMock()
sys.modules['spacy'] = MagicMock()
sys.modules['textblob'] = MagicMock()
sys.modules['playwright'] = MagicMock()
sys.modules['playwright.sync_api'] = MagicMock()
sys.modules['openpyxl'] = MagicMock()
sys.modules['lxml'] = MagicMock()
sys.modules['duckduckgo_search'] = MagicMock()
sys.modules['openai'] = MagicMock()
sys.modules['anthropic'] = MagicMock()
sys.modules['google'] = MagicMock()
sys.modules['google.generativeai'] = MagicMock()
sys.modules['bs4'] = MagicMock()

# Import create_app after mocks
# Ensure REQUIRED env vars are present before config evaluation
os.environ['SECRET_KEY'] = 'test-secret-key'
os.environ['JWT_SECRET'] = 'test-jwt-secret'
os.environ['GOOGLE_DEFAULT_COOKIE'] = 'test-cookie'

from apps.web import create_app
from apps.core import database

class TestSecurityConfig(unittest.TestCase):
    def test_password_auto_hashing(self):
        """Test that plain text passwords are hashed on app creation."""

        # Define a custom config class
        class TestConfig:
            CLIENTS_AREA_PASSWORD = "plain_password"
            OPERATOR_PASSWORD = "another_plain_password"
            SECRET_KEY = "test"
            TESTING = True
            # Add other possibly required config attributes here if create_app/config object needs them
            MAX_CONTENT_LENGTH = 1000
            DEFAULT_COOKIE = "cookie"
            DATAFORSEO_LOGIN = None
            DATAFORSEO_PASSWORD = None
            JWT_SECRET = "secret"
            USER_AGENTS = []

        # We need to mock database.init_db as well, which is called inside create_app
        # Also mock start_monitor which is conditional on TESTING config, but better be safe
        with patch('apps.web.init_db') as mock_init_db, \
             patch('apps.web.start_monitor') as mock_monitor:

            # Since create_app expects a class, we pass TestConfig
            app = create_app(TestConfig)

            clients_pass = app.config['CLIENTS_AREA_PASSWORD']
            operator_pass = app.config['OPERATOR_PASSWORD']

            # Verify they are hashed (start with bcrypt prefix $2)
            self.assertTrue(clients_pass.startswith('$2'))
            self.assertTrue(operator_pass.startswith('$2'))
            self.assertNotEqual(clients_pass, "plain_password")

if __name__ == '__main__':
    unittest.main()

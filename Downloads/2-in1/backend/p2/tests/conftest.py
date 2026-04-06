import os
import pytest

# Ensure required environment variables for config module evaluation
os.environ['SECRET_KEY'] = 'test-secret-key-for-conftest'
os.environ['JWT_SECRET'] = 'test-jwt-secret-for-conftest'
os.environ['GOOGLE_DEFAULT_COOKIE'] = 'test-cookie-for-conftest'

from apps.web import create_app
from apps.core.config import Config

class TestConfig(Config):
    TESTING = True

@pytest.fixture
def app():
    app = create_app(TestConfig)
    yield app

@pytest.fixture
def client(app):
    return app.test_client()

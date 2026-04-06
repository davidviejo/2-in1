import pytest
from unittest.mock import patch, MagicMock
from apps.web import create_app
import logging

# Disable logging
logging.getLogger('apps').setLevel(logging.CRITICAL)

@pytest.fixture
def client():
    app = create_app()
    app.config['TESTING'] = True
    with patch('apps.core.database.get_db_connection'):
        with app.test_client() as client:
            yield client

def test_pixel_tool_ssrf(client):
    """Verify pixel tool rejects unsafe URLs"""
    with patch('requests.get') as mock_get:
        resp = client.post('/pixel/analyze', json={'urls': ['http://127.0.0.1']})
        assert resp.status_code == 200
        data = resp.json.get('data', [])
        assert len(data) == 1
        assert data[0]['error'] == 'URL no permitida'
        mock_get.assert_not_called()

def test_link_opps_ssrf(client):
    """Verify link opps tool rejects unsafe URLs"""
    with patch('requests.get') as mock_get:
        resp = client.post('/opps/scan', json={
            'urls': ['http://127.0.0.1'],
            'keyword': 'test',
            'target_url': 'http://example.com'
        })
        assert resp.status_code == 200
        data = resp.json.get('data', [])
        # Should return empty list because find_opp returns None for unsafe URLs
        assert len(data) == 0
        mock_get.assert_not_called()

def test_duplicate_tool_ssrf(client):
    """Verify duplicate tool rejects unsafe URLs"""
    with patch('requests.get') as mock_get:
        # Both URLs unsafe -> No requests
        resp = client.post('/duplicate/compare', json={
            'url1': 'http://127.0.0.1',
            'url2': 'http://127.0.0.1'
        })
        assert resp.status_code == 200
        mock_get.assert_not_called()

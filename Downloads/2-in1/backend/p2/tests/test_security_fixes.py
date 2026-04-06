import pytest
import io
from apps.web import create_app
from apps.tools.utils import validate_url

def test_validate_url():
    assert validate_url("http://google.com")
    assert validate_url("https://example.com/path")
    assert not validate_url("ftp://google.com")
    assert not validate_url("google.com")
    assert not validate_url("")
    assert not validate_url(None)
    assert not validate_url(123)

@pytest.fixture
def client():
    app = create_app()
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_audit_scan_invalid_url(client):
    response = client.post('/audit/scan', data={'sitemap_url': 'invalid-url'})
    assert response.status_code == 200 # It returns JSON error, not 400
    assert 'error' in response.json
    assert response.json['error'] in ['URL inválida', 'URL no permitida']

def test_nlp_analyze_bulk_invalid_format(client):
    response = client.post('/nlp/analyze_bulk', json={'urls': 'not-a-list'})
    assert response.status_code == 400
    assert 'error' in response.json

def test_image_audit_scan_invalid_format(client):
    response = client.post('/image_audit/scan', json={'urls': 'not-a-list'})
    assert response.status_code == 400
    assert 'error' in response.json


def test_upload_clusters_invalid_file(client):
    from unittest.mock import patch
    # Simulate a file upload with invalid extension
    data = {
        'id': 'test-project',
        'file': (io.BytesIO(b"dummy content"), 'test.txt')
    }

    # Mock verify_token to bypass authentication for this specific endpoint
    with patch('apps.web.portal_bp.verify_token', return_value={'role': 'operator', 'sub': 'test'}):
        response = client.post('/projects/upload_clusters', data=data, content_type='multipart/form-data', headers={'Authorization': 'Bearer test'})
        assert response.status_code == 400
        assert b"Formato no soportado" in response.data

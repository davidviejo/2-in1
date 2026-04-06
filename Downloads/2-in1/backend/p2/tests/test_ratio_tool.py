import pytest
from unittest.mock import patch, MagicMock

def test_ratio_analyze_success(client):
    """Test successful ratio calculation with valid HTML."""
    # HTML contains script (which should be removed) and p tag (text kept)
    html_content = b"<html><body><script>var x=1;</script><p>Hello World</p></body></html>"
    # Text extracted should be "Hello World" -> 11 bytes

    with patch('apps.web.blueprints.ratio_tool.requests.get') as mock_get:
        mock_response = MagicMock()
        mock_response.content = html_content
        mock_get.return_value = mock_response

        response = client.post('/ratio/analyze', json={'urls': ['http://example.com']})

        assert response.status_code == 200
        data = response.get_json()['data']
        assert len(data) == 1
        item = data[0]
        assert item['url'] == 'http://example.com'
        assert item['text'] == 11
        assert item['html'] == len(html_content)
        assert item['ratio'] > 0

def test_ratio_analyze_exception(client):
    """Test graceful handling of request exceptions."""
    with patch('apps.web.blueprints.ratio_tool.requests.get') as mock_get:
        mock_get.side_effect = Exception("Connection refused")

        response = client.post('/ratio/analyze', json={'urls': ['http://fail.com']})

        assert response.status_code == 200
        data = response.get_json()['data']
        # The tool catches exception and continues/skips
        assert len(data) == 0

def test_ratio_analyze_empty_html(client):
    """Test handling of empty HTML response."""
    with patch('apps.web.blueprints.ratio_tool.requests.get') as mock_get:
        mock_response = MagicMock()
        mock_response.content = b""
        mock_get.return_value = mock_response

        response = client.post('/ratio/analyze', json={'urls': ['http://empty.com']})

        assert response.status_code == 200
        data = response.get_json()['data']
        assert len(data) == 0

def test_ratio_validation(client):
    """Test validation of empty or invalid inputs."""
    # Empty list
    response = client.post('/ratio/analyze', json={'urls': []})
    assert response.status_code == 200
    assert response.get_json()['data'] == []

    # Empty string URL
    response = client.post('/ratio/analyze', json={'urls': ['   ']})
    assert response.status_code == 200
    assert response.get_json()['data'] == []

import pytest
from unittest.mock import patch, MagicMock
from apps.web.blueprints.overlap_tool import get_urls

def test_get_urls_serpapi():
    kw = "test keyword"
    cfg = {
        'mode': 'serpapi',
        'key': 'test_api_key'
    }

    mock_response = MagicMock()
    mock_response.json.return_value = {
        "organic_results": [
            {"link": "https://example.com/1"},
            {"link": "https://example.com/2"}
        ]
    }

    with patch('requests.get', return_value=mock_response) as mock_get:
        urls = get_urls(kw, cfg)

        assert urls == ["https://example.com/1", "https://example.com/2"]

        mock_get.assert_called_once()
        args, kwargs = mock_get.call_args
        assert args[0] == "https://serpapi.com/search"
        assert kwargs['params']['q'] == kw
        assert kwargs['params']['api_key'] == 'test_api_key'
        assert kwargs['params']['engine'] == 'google'

def test_get_urls_serpapi_error():
    kw = "test keyword"
    cfg = {
        'mode': 'serpapi',
        'key': 'test_api_key'
    }

    mock_response = MagicMock()
    mock_response.json.return_value = {"error": "Invalid key"}

    with patch('requests.get', return_value=mock_response):
        urls = get_urls(kw, cfg)
        assert urls == []

def test_get_urls_serpapi_exception():
    kw = "test keyword"
    cfg = {
        'mode': 'serpapi',
        'key': 'test_api_key'
    }

    with patch('requests.get', side_effect=Exception("Connection error")):
        urls = get_urls(kw, cfg)
        assert urls == []

import pytest
from unittest.mock import patch, MagicMock
from apps.web.blueprints.seo_tool import dispatcher

def test_dispatcher_serpapi_success():
    kw = "test keyword"
    cfg = {
        'mode': 'serpapi',
        'cse_key': 'test_api_key',
        'top_n': 10,
        'gl': 'es',
        'hl': 'es',
        'tos': 15
    }

    mock_response = MagicMock()
    mock_response.json.return_value = {
        "organic_results": [
            {"link": "https://example.com/1", "title": "Title 1"},
            {"link": "https://example.com/2", "title": "Title 2"}
        ]
    }

    with patch('apps.web.blueprints.seo_tool.requests.get', return_value=mock_response) as mock_get:
        results = dispatcher(kw, cfg)

        assert len(results) == 2
        assert results[0]['url'] == "https://example.com/1"
        assert results[0]['title'] == "Title 1"
        assert results[0]['rank'] == 1

        mock_get.assert_called_once()
        args, kwargs = mock_get.call_args
        assert args[0] == "https://serpapi.com/search"
        assert kwargs['params']['api_key'] == 'test_api_key'
        assert kwargs['params']['google_domain'] == 'google.es'

def test_dispatcher_serpapi_error():
    kw = "test keyword"
    cfg = {
        'mode': 'serpapi',
        'cse_key': 'test_api_key',
        'top_n': 10,
        'gl': 'es',
        'hl': 'es',
        'tos': 15
    }

    mock_response = MagicMock()
    mock_response.json.return_value = {"error": "Invalid key"}

    with patch('apps.web.blueprints.seo_tool.requests.get', return_value=mock_response):
        with pytest.raises(Exception, match="SerpApi Error"):
            dispatcher(kw, cfg)

def test_dispatcher_serpapi_exception():
    kw = "test keyword"
    cfg = {
        'mode': 'serpapi',
        'cse_key': 'test_api_key',
        'top_n': 10,
        'gl': 'es',
        'hl': 'es',
        'tos': 15
    }

    with patch('apps.web.blueprints.seo_tool.requests.get', side_effect=Exception("Connection error")):
        results = dispatcher(kw, cfg)
        assert results == []

import pytest
from unittest.mock import patch, MagicMock
from apps.web.blueprints.seo_tool import dispatcher

def test_dispatcher_dataforseo_pass_params():
    kw = "test keyword"
    cfg = {
        'mode': 'dataforseo',
        'dfs_login': 'user@example.com',
        'dfs_pass': 'secret',
        'top_n': 10,
        'gl': 'es',
        'hl': 'es'
    }

    # Mock smart_serp_search
    with patch('apps.web.blueprints.seo_tool.smart_serp_search') as mock_smart_search:
        mock_smart_search.return_value = [{'url': 'http://example.com', 'title': 'Test', 'rank': 1}]

        results = dispatcher(kw, cfg)

        mock_smart_search.assert_called_once()
        args, kwargs = mock_smart_search.call_args

        # Verify arguments passed to smart_serp_search
        assert kwargs['keyword'] == kw
        assert kwargs['config'] == cfg
        assert kwargs['num_results'] == 10
        assert kwargs['lang'] == 'es'
        assert kwargs['country'] == 'es'

        # Verify result
        assert len(results) == 1
        assert results[0]['url'] == 'http://example.com'

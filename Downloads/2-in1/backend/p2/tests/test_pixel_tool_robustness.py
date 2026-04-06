
import sys
from unittest.mock import MagicMock, patch

# Mock dependencies before importing apps
sys.modules['duckduckgo_search'] = MagicMock()
sys.modules['spacy'] = MagicMock()
sys.modules['textblob'] = MagicMock()
sys.modules['openai'] = MagicMock()
sys.modules['anthropic'] = MagicMock()
sys.modules['google.generativeai'] = MagicMock()

import pytest
from apps.web.blueprints.pixel_tool import check_px

def test_check_px_missing_content_attribute():
    """Test when meta description tag exists but has no content attribute."""
    with patch('apps.web.blueprints.pixel_tool.requests.get') as mock_get:
        # <html><head><meta name="description"></head></html>
        # BS4 by default returns empty string for missing attribute? No, None.
        # But let's mock the HTML response directly to use real BS4 (if installed) or mock BS4 if not.

        # We rely on installed BS4 for parsing behavior here
        mock_get.return_value.content = b'<html><head><title>T</title><meta name="description"></head></html>'
        mock_get.return_value.status_code = 200

        res = check_px('http://example.com')
        assert res['t_px'] > 0
        assert res['d_px'] == 0
        assert 'error' not in res

def test_check_px_none_content_attribute():
    """Test when meta description content attribute is present but None (e.g. parsed as boolean)."""
    with patch('apps.web.blueprints.pixel_tool.requests.get') as mock_get:
        # <html><head><meta name="description" content></head></html>
        mock_get.return_value.content = b'<html><head><title>T</title><meta name="description" content></head></html>'
        mock_get.return_value.status_code = 200

        # In html.parser, boolean attribute value is usually empty string.
        # But we want to ensure robustness even if it returns None.
        # So we mock BS4 behavior explicitly for this test case to simulate the crash scenario.

        with patch('apps.web.blueprints.pixel_tool.BeautifulSoup') as mock_bs:
            mock_soup = MagicMock()
            mock_bs.return_value = mock_soup
            mock_soup.title.get_text.return_value = "Title"

            mock_meta = MagicMock()
            mock_soup.find.return_value = mock_meta

            # Simulate get returning None for content
            def get_side_effect(k, default=None):
                if k == 'content':
                    return None
                return default
            mock_meta.get.side_effect = get_side_effect

            res = check_px('http://example.com')
            assert res['t_px'] > 0
            assert res['d_px'] == 0
            assert 'error' not in res

def test_check_px_normal_content():
    """Test normal content."""
    with patch('apps.web.blueprints.pixel_tool.requests.get') as mock_get:
        mock_get.return_value.content = b'<html><head><title>Title</title><meta name="description" content="Description"></head></html>'
        mock_get.return_value.status_code = 200

        res = check_px('http://example.com')
        assert res['t_px'] > 0
        assert res['d_px'] > 0
        assert 'error' not in res

if __name__ == "__main__":
    print("Running tests manually...")
    test_check_px_missing_content_attribute()
    print("test_check_px_missing_content_attribute passed")
    test_check_px_none_content_attribute()
    print("test_check_px_none_content_attribute passed")
    test_check_px_normal_content()
    print("test_check_px_normal_content passed")

import pytest
from unittest.mock import patch, MagicMock
from apps.web.blueprints.ctr_tool import score_title
from apps.web.blueprints.expired_tool import check_dns
from apps.web.blueprints.meta_gen import gen

# --- Tests for apps/ctr_tool.py ---

def test_score_title_high():
    # Title with optimal length (40-60), numbers, parentheses, and power words
    # "Guía definitiva de SEO 2025 para principiantes (Tutorial)" is 57 chars.
    title = "Guía definitiva de SEO 2025 para principiantes (Tutorial)"
    res = score_title(title)

    # Base 50
    # +10 (Length 40-60)
    # +10 (Digits "2025")
    # +10 (Parentheses)
    # +20 (Power words "guía")
    # Total = 100
    assert res['score'] == 100
    assert "Números" in res['checks']
    assert "Paréntesis" in res['checks']
    assert "Power Words" in res['checks']

def test_score_title_low():
    # Short title, no special elements
    title = "Hola Mundo"
    res = score_title(title)
    # Base 50. Len 10 (not 40-60). No digits, no parens, no power words.
    assert res['score'] == 50
    assert res['checks'] == []

# --- Tests for apps/expired_tool.py ---

def test_check_dns_active():
    # Simulate domain resolving
    with patch('apps.web.blueprints.expired_tool.socket.gethostbyname') as mock_dns:
        mock_dns.return_value = "1.1.1.1"
        assert check_dns("example.com") == "Active"

def test_check_dns_available():
    # Simulate domain not resolving (raising exception)
    with patch('apps.web.blueprints.expired_tool.socket.gethostbyname') as mock_dns:
        mock_dns.side_effect = Exception("NXDOMAIN")
        assert check_dns("nonexistent.com") == "AVAILABLE"

# --- Tests for apps/meta_gen.py ---

def test_gen_success():
    # Simulate safe URL and valid HTML response
    with patch('apps.web.blueprints.meta_gen.is_safe_url', return_value=True), \
         patch('apps.web.blueprints.meta_gen.requests.get') as mock_get:

        mock_resp = MagicMock()
        mock_resp.content = b'<html><body><h1>My Title</h1><p>First paragraph content.</p></body></html>'
        mock_get.return_value = mock_resp

        url = "http://example.com"
        title_tpl = "{h1} | {domain}"
        desc_tpl = "{intro}..."

        res = gen(url, title_tpl, desc_tpl)

        assert res['status'] == 'OK'
        # Domain parsing for http://example.com -> example.com
        assert res['gen_title'] == "My Title | example.com"
        # Intro is first 150 chars of p.
        assert res['gen_desc'] == "First paragraph content...."

def test_gen_unsafe():
    # Simulate unsafe URL
    with patch('apps.web.blueprints.meta_gen.is_safe_url', return_value=False):
        res = gen("http://unsafe.local", "", "")
        assert res['status'] == 'URL no permitida'

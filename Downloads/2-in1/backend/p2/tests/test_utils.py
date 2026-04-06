from unittest.mock import patch
from apps.tools.utils import validate_url, clean_url, is_safe_url, normalize

def test_normalize():
    assert normalize("Héllò Wórld") == "hello world"
    assert normalize("Café") == "cafe"
    assert normalize("ASDF") == "asdf"
    assert normalize("") == ""

def test_validate_url_valid():
    assert validate_url("https://example.com") is True
    assert validate_url("http://example.com") is True
    assert validate_url("https://sub.example.com/path?q=1") is True

def test_validate_url_invalid():
    assert validate_url("ftp://example.com") is False
    assert validate_url("example.com") is False
    assert validate_url("not a url") is False
    assert validate_url("") is False
    assert validate_url(None) is False
    assert validate_url(123) is False

def test_clean_url():
    assert clean_url("  http://example.com  ") == "http://example.com"
    assert clean_url("http://example.com") == "http://example.com"
    assert clean_url("") == ""
    assert clean_url(None) == ""
    assert clean_url("   ") == ""
    assert clean_url("\thttp://example.com\n") == "http://example.com"

def test_is_safe_url():
    with patch('socket.gethostbyname') as mock_dns:
        # Public IP
        mock_dns.return_value = "8.8.8.8"
        assert is_safe_url("https://google.com") is True

        # Localhost
        mock_dns.return_value = "127.0.0.1"
        assert is_safe_url("http://localhost") is False

        # Private IP
        mock_dns.return_value = "192.168.1.1"
        assert is_safe_url("http://192.168.1.1") is False

        # Another private IP
        mock_dns.return_value = "10.0.0.5"
        assert is_safe_url("http://internal.service") is False

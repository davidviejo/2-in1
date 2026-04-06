import pytest
from unittest.mock import patch
from apps.web.blueprints.serp_scanner import is_valid_url, find_competitors, BLACKLIST

class TestSerpScanner:
    # --- Tests for is_valid_url ---

    def test_is_valid_url_valid_domains(self):
        """Test valid organic domains that should pass."""
        valid_urls = [
            "https://www.mi-competidor.es",
            "http://blog.seo.com/articulo",
            "https://tienda.local.net",
            "https://example.com/page?q=test&id=123"
        ]
        for url in valid_urls:
            assert is_valid_url(url) is True

    def test_is_valid_url_blacklisted_domains(self):
        """Test URLs containing blacklisted strings should fail."""
        # Using the actual blacklist to ensure thorough coverage
        for b in BLACKLIST:
            # Construct a URL with the blacklisted string. b already contains a trailing dot, so we can append directly.
            url = f"https://www.{b}com/page"
            assert is_valid_url(url) is False

    def test_is_valid_url_case_insensitivity(self):
        """Test that blacklisted domains are caught regardless of case."""
        case_urls = [
            "HTTPS://WWW.AMAZON.COM",
            "http://WIKIPEDIA.org",
            "https://FaceBook.com/profile"
        ]
        for url in case_urls:
            assert is_valid_url(url) is False

    def test_is_valid_url_subdomains(self):
        """Test that blacklisted strings in subdomains are caught."""
        subdomain_urls = [
            "https://sub.milanuncios.com",
            "http://shop.amazon.es",
            "https://es.wikipedia.org/wiki/SEO"
        ]
        for url in subdomain_urls:
            assert is_valid_url(url) is False

    def test_is_valid_url_edge_cases(self):
        """Test edge cases like empty strings and None."""
        assert is_valid_url("") is False
        assert is_valid_url(None) is False

    # --- Tests for find_competitors ---

    @patch('apps.web.blueprints.serp_scanner.smart_serp_search')
    def test_find_competitors_success(self, mock_search):
        """Test finding competitors successfully filters out blacklisted ones."""
        # Mocking smart_serp_search to return a mix of valid and invalid URLs
        mock_search.return_value = [
            {"title": "Amazon Result", "url": "https://www.amazon.es/producto", "snippet": "A"},
            {"title": "Valid Competitor 1", "url": "https://www.competidor1.es", "snippet": "C1"},
            {"title": "Wikipedia Result", "url": "https://es.wikipedia.org/wiki/Tema", "snippet": "W"},
            {"title": "Valid Competitor 2", "url": "https://www.competidor2.com", "snippet": "C2"},
            {"title": "Valid Competitor 3", "url": "https://www.competidor3.net", "snippet": "C3"}
        ]

        # Call with limit=2
        results = find_competitors("comprar zapatos", limit=2)

        # Verify it filtered correctly and respected the limit
        assert len(results) == 2
        assert results[0]["url"] == "https://www.competidor1.es"
        assert results[1]["url"] == "https://www.competidor2.com"

    @patch('apps.web.blueprints.serp_scanner.smart_serp_search')
    def test_find_competitors_empty_keyword(self, mock_search):
        """Test that an empty keyword returns an empty list."""
        assert find_competitors("") == []
        assert find_competitors(None) == []
        # Ensure search wasn't called
        mock_search.assert_not_called()

    @patch('apps.web.blueprints.serp_scanner.smart_serp_search')
    def test_find_competitors_exception_handling(self, mock_search):
        """Test that exceptions during search are handled gracefully."""
        # Make the mock raise an exception
        mock_search.side_effect = Exception("API Failure")

        results = find_competitors("error keyword")
        assert results == []

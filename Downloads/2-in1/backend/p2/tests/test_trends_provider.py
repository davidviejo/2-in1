import unittest
from unittest.mock import patch, MagicMock
from apps.web.blueprints.trends_provider import (
    SerpApiProvider,
    GoogleInternalProvider,
    DataForSEOProvider,
    fetch_trends_strategy
)

class TestTrendsProvider(unittest.TestCase):

    @patch('apps.web.blueprints.trends_provider.requests.get')
    def test_serpapi_provider(self, mock_get):
        # Mock SerpApi response
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "daily_searches": [
                {"query": "Test Topic", "formatted_traffic": "10K+"}
            ]
        }
        mock_get.return_value = mock_resp

        provider = SerpApiProvider()
        results = provider.fetch_trends("US", "h", api_key="dummy_key")

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['topic'], "Test Topic")
        self.assertEqual(results[0]['traffic'], "10K+")
        self.assertIn("google.com/search?q=Test Topic", results[0]['google_link'])

    @patch('apps.web.blueprints.trends_provider.requests.get')
    def test_google_internal_provider(self, mock_get):
        # Mock Google Internal response
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = ")]}',\n" + '{"trendingStories": [{"title": "Internal Topic", "articles": [{"articleTitle": "Context", "source": "Source", "url": "http://link"}]}]}'
        mock_get.return_value = mock_resp

        provider = GoogleInternalProvider()
        results = provider.fetch_trends("ES", "h")

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['topic'], "Internal Topic")
        self.assertEqual(results[0]['context'], "Context")

    @patch('apps.web.blueprints.trends_provider.requests.post')
    def test_dataforseo_provider(self, mock_post):
        # Mock DataForSEO response
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "status_code": 20000,
            "tasks": [{
                "result": [{
                    "items": [
                        {"keyword": "DFS Topic", "keyword_info": {"search_volume": 5000}}
                    ]
                }]
            }]
        }
        mock_post.return_value = mock_resp

        provider = DataForSEOProvider()
        results = provider.fetch_trends("ES", "h", login="user", password="pass")

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['topic'], "DFS Topic")
        self.assertEqual(results[0]['traffic'], "5000 vol")

    @patch('apps.web.blueprints.trends_provider.SerpApiProvider.fetch_trends')
    def test_strategy_serpapi(self, mock_fetch):
        fetch_trends_strategy("US", "h", provider_name="serpapi", api_key="key")
        mock_fetch.assert_called_once()

    @patch('apps.web.blueprints.trends_provider.DataForSEOProvider.fetch_trends')
    def test_strategy_dataforseo(self, mock_fetch):
        fetch_trends_strategy("US", "h", provider_name="dataforseo", login="u", password="p")
        mock_fetch.assert_called_once()

if __name__ == '__main__':
    unittest.main()

from unittest.mock import patch, MagicMock
from apps.tools.scraper_core import fetch_url_hybrid, get_optimized_headers, parse_google_html

def test_get_optimized_headers():
    headers = get_optimized_headers()
    assert 'User-Agent' in headers
    assert 'Cookie' in headers

@patch('apps.tools.scraper_core.requests.get')
def test_fetch_url_hybrid_requests_success(mock_get):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.content = b'<html>Content</html>' * 100 # Make it > 500 bytes
    mock_get.return_value = mock_response

    result = fetch_url_hybrid('http://example.com', delay=0)

    assert result['status'] == 200
    assert result['method'] == 'Requests'
    assert b'Content' in result['content']

@patch('apps.tools.scraper_core.requests.get')
@patch('apps.tools.scraper_core._run_async_playwright')
def test_fetch_url_hybrid_playwright_fallback(mock_run_async_playwright, mock_get):
    # Mock requests failure
    mock_response = MagicMock()
    mock_response.status_code = 403
    mock_get.return_value = mock_response

    # Mock Playwright async wrapper
    mock_run_async_playwright.return_value = '<html>Playwright Content</html>'

    result = fetch_url_hybrid('http://example.com', delay=0)

    assert result['status'] == 200
    assert result['method'] == 'Playwright (JS)'
    assert 'Playwright Content' in result['content']

def test_parse_google_html_normal():
    # Mock a modern Google SERP result
    html = """
    <div class="g">
        <div class="yuRUbf">
            <a href="https://example.com/page">
                <br>
                <h3 class="LC20lb MBeuO DKV0Md">Example Title</h3>
            </a>
        </div>
    </div>
    <div class="g">
        <div class="yuRUbf">
            <a href="https://other.com">
                <h3 class="LC20lb">Other Title</h3>
            </a>
        </div>
    </div>
    """
    results = parse_google_html(html)
    assert len(results) == 2
    assert results[0]['url'] == "https://example.com/page"
    assert results[0]['title'] == "Example Title"
    assert results[1]['url'] == "https://other.com"
    assert results[1]['title'] == "Other Title"

def test_parse_google_html_edge():
    # Empty HTML
    assert parse_google_html("") == []

    # HTML with no valid results
    html_garbage = "<div>Nothing here</div>"
    assert parse_google_html(html_garbage) == []

    # HTML with blocked result (google.com)
    html_blocked = """
    <div class="g">
        <a href="https://google.com/search?q=test">
            <h3>Google Search</h3>
        </a>
    </div>
    """
    # The logic filters 'google.' URLs
    results = parse_google_html(html_blocked)
    assert len(results) == 0

def test_parse_google_html_captcha_signal():
    html_blocked = "<html><body>Our systems have detected unusual traffic from your computer network. Sorry...</body></html>"
    assert parse_google_html(html_blocked) == {"status": "blocked"}

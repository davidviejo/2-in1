
from unittest.mock import patch, MagicMock

# Imports of functions to test
from apps.web.blueprints.tech_detector import detect
from apps.web.blueprints.prominence_tool import check_prominence
from apps.web.blueprints.snippet_tool import analyze_snippet
from apps.web.blueprints.meta_gen import gen
from apps.web.blueprints.social_tool import check as check_social

# --- apps.tech_detector.detect ---

@patch('apps.web.blueprints.tech_detector.requests.get')
def test_tech_detector_detect_normal(mock_get):
    """Test standard detection of WordPress and Yoast."""
    mock_resp = MagicMock()
    mock_resp.headers = {'Server': 'Apache'}
    # HTML containing WP and Yoast signatures
    mock_resp.text = '<html><head></head><body>... /wp-content/ ... <!-- This site is optimized with the Yoast SEO plugin --> ...</body></html>'
    mock_get.return_value = mock_resp

    result = detect("http://example.com")

    assert result['cms'] == 'WordPress'
    assert result['seo'] == 'Yoast'
    assert result['server'] == 'Apache'

@patch('apps.web.blueprints.tech_detector.requests.get')
def test_tech_detector_detect_edge(mock_get):
    """Test network failure handling."""
    mock_get.side_effect = Exception("Network Down")

    result = detect("http://fail.com")

    # Should return defaults
    assert result['cms'] == 'Unknown'
    assert result['seo'] == 'None'
    assert result['analytics'] == []

# --- apps.prominence_tool.check_prominence ---

@patch('apps.web.blueprints.prominence_tool.requests.get')
def test_prominence_tool_check_prominence_normal(mock_get):
    """Test prominence calculation with keyword present."""
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.content = b'<html><title>SEO Guide</title><body><h1>Ultimate SEO Guide</h1><p>SEO is important.</p></body></html>'
    mock_get.return_value = mock_resp

    # Keyword "seo" is in Title, H1, Intro
    result = check_prominence("http://example.com", "seo")

    assert result['error'] is None
    assert result['checks']['Title'] is True
    assert result['checks']['H1'] is True
    assert result['score'] > 0

@patch('apps.web.blueprints.prominence_tool.requests.get')
def test_prominence_tool_check_prominence_edge(mock_get):
    """Test 404 handling."""
    mock_resp = MagicMock()
    mock_resp.status_code = 404
    mock_get.return_value = mock_resp

    result = check_prominence("http://example.com/404", "seo")

    assert 'Status 404' in result['error']

# --- apps.web.blueprints.snippet_tool.analyze_snippet ---

@patch('apps.web.blueprints.snippet_tool.requests.get')
def test_snippet_tool_analyze_snippet_normal(mock_get):
    """Test snippet extraction when keyword found."""
    mock_resp = MagicMock()
    mock_resp.content = b'<html><body><h2>What is Python?</h2><p>Python is a programming language.</p></body></html>'
    mock_get.return_value = mock_resp

    result = analyze_snippet("http://example.com", "python")

    assert result['found'] is True
    assert "Python is a programming language" in result['text']

@patch('apps.web.blueprints.snippet_tool.requests.get')
def test_snippet_tool_analyze_snippet_edge(mock_get):
    """Test when keyword is not found."""
    mock_resp = MagicMock()
    mock_resp.content = b'<html><body><h2>Java</h2><p>Java is cool.</p></body></html>'
    mock_get.return_value = mock_resp

    result = analyze_snippet("http://example.com", "python")

    assert result['found'] is False
    assert result['text'] == ''

# --- apps.meta_gen.gen ---

@patch('apps.web.blueprints.meta_gen.requests.get')
def test_meta_gen_gen_normal(mock_get):
    """Test meta generation with templates."""
    mock_resp = MagicMock()
    mock_resp.content = b'<html><h1>My Header</h1><p>Intro paragraph.</p></html>'
    mock_get.return_value = mock_resp

    # Template: Title -> "{h1} | {domain}", Desc -> "{intro}"
    result = gen("http://example.com/page", "{h1} | {domain}", "{intro}")

    assert result['status'] == 'OK'
    assert "My Header" in result['gen_title']
    assert "Intro paragraph" in result['gen_desc']

@patch('apps.web.blueprints.meta_gen.requests.get')
def test_meta_gen_gen_edge(mock_get):
    """Test handling of missing elements (no H1)."""
    mock_resp = MagicMock()
    mock_resp.content = b'<html><body><p>Just text</p></body></html>'
    mock_get.return_value = mock_resp

    result = gen("http://example.com", "Title: {h1}", "Desc: {h1}")

    # h1 is empty string if not found
    assert result['status'] == 'OK'
    # .replace('{h1}', '') -> "Title: "
    assert result['gen_title'] == "Title: "

# --- apps.social_tool.check ---

@patch('apps.web.blueprints.social_tool.requests.get')
def test_social_tool_check_normal(mock_get):
    """Test social check with valid OG tags."""
    mock_resp = MagicMock()
    mock_resp.content = b'<html><head><meta property="og:title" content="My Title"><meta property="og:image" content="img.jpg"></head></html>'
    mock_get.return_value = mock_resp

    result = check_social("http://example.com")

    assert result['error'] is None
    assert result['og']['title'] == "My Title"
    assert result['og']['image'] == "img.jpg"
    assert len(result['warnings']) == 0

@patch('apps.web.blueprints.social_tool.requests.get')
def test_social_tool_check_edge(mock_get):
    """Test social check with missing tags."""
    mock_resp = MagicMock()
    mock_resp.content = b'<html><head></head></html>'
    mock_get.return_value = mock_resp

    result = check_social("http://example.com")

    assert "Falta og:title" in result['warnings']
    assert "Falta og:image" in result['warnings']

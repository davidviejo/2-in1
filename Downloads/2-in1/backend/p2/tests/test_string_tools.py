import pytest
from apps.web.blueprints.migration_tool import slugify
from apps.web.blueprints.ctr_tool import score_title
from apps.web.blueprints.log_tool import analyze

# --- Tests for apps/migration_tool.py ---

def test_slugify_normal():
    # Normal case: accents, spaces, uppercase
    assert slugify("Hóla Múndo") == "hola-mundo"
    assert slugify("Café & Té") == "cafe-te"
    assert slugify("Python 3.10") == "python-3-10"

def test_slugify_edge():
    # Edge cases: empty, special chars only
    assert slugify("") == ""
    assert slugify("!!!") == ""
    assert slugify("   ") == ""
    # None handling: str(None) -> "none" in implementation
    assert slugify(None) == "none"

# --- Tests for apps/ctr_tool.py ---

def test_score_title_normal():
    # "Guía completa de SEO para el año 2025: Estrategias" -> Length 50
    # Length 40-60 (+10)
    # Numbers "2025" (+10)
    # Power words "guía" (+20)
    # Base 50 + 10 + 10 + 20 = 90
    title = "Guía completa de SEO para el año 2025: Estrategias"
    res = score_title(title)
    assert res['score'] >= 90
    assert "Power Words" in res['checks']
    assert "Números" in res['checks']

def test_score_title_edge():
    # Empty title
    # Base 50. Length 0 (no bonus).
    res = score_title("")
    assert res['score'] == 50
    assert res['checks'] == []

    # Short title with parens
    # "SEO (2025)" -> Length 10.
    # Numbers (+10). Parens (+10).
    # Power words: "2025" is in the power words list! (+20)
    # Base 50 + 10 + 10 + 20 = 90.
    res = score_title("SEO (2025)")
    assert res['score'] == 90
    assert "Paréntesis" in res['checks']
    assert "Power Words" in res['checks']

# --- Tests for apps/log_tool.py ---

def test_analyze_log_normal():
    log_data = '''
    66.249.66.1 - - [21/Jan/2025:10:00:00 +0000] "GET /test-url HTTP/1.1" 200 1234 "-" "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
    1.2.3.4 - - [21/Jan/2025:10:01:00 +0000] "GET /other HTTP/1.1" 404 123 "-" "Mozilla/5.0"
    '''
    # analyze checks for 'Googlebot' in line
    # Then regex search for GET/POST and Status
    # Line 1: Has Googlebot. URL: /test-url. Status: 200.
    # Line 2: No Googlebot. Skipped.

    hits = analyze(log_data)
    assert len(hits) == 1
    assert hits[0]['url'] == '/test-url'
    assert hits[0]['status'] == 200
    assert hits[0]['bot'] == 'Googlebot'

def test_analyze_log_edge():
    # Empty log
    assert analyze("") == []

    # No Googlebot
    log_data = '1.2.3.4 - - "GET / HTTP/1.1" 200 123 "-" "Chrome"'
    assert analyze(log_data) == []

    # Googlebot but malformed line (no HTTP method/status match)
    # Regex: r'"(GET|POST) (.*?) HTTP.*?" (\d{3})'
    log_data = 'Googlebot was here but not doing HTTP request'
    assert analyze(log_data) == []

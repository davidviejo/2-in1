import time
from apps.web.blueprints.migration_tool import slugify
from apps.web.blueprints.autopilot import classify_intent, analyze_performance_sim
from apps.web.blueprints.ctr_tool import score_title
from apps.web.blueprints.serp_scanner import is_valid_url
from apps.web.blueprints.schema_detector import extract_types_recursive

# --- apps.migration_tool.slugify ---
def test_slugify_normal():
    assert slugify("Café con Leche") == "cafe-con-leche"
    assert slugify("Hello World 123") == "hello-world-123"
    assert slugify(" Simple  Test ") == "simple-test"

def test_slugify_edge():
    assert slugify("!!!") == ""
    assert slugify("") == ""
    assert slugify("---") == ""

# --- apps.autopilot.classify_intent ---
def test_classify_intent_normal():
    assert "Transaccional" in classify_intent("comprar iphone")
    assert "Informacional" in classify_intent("qué es seo")
    assert "Comercial" in classify_intent("mejor movil")
    assert "Navegacional" in classify_intent("facebook login")

def test_classify_intent_edge():
    assert "Mixta" in classify_intent("mesa")
    assert "Mixta" in classify_intent("")
    assert "Mixta" in classify_intent(None)

# --- apps.autopilot.analyze_performance_sim ---
def test_analyze_performance_sim_normal():
    # Mocking time logic by just passing relative time
    simulated_start = time.time() - 0.1
    score, ttfb = analyze_performance_sim(simulated_start, 1024)
    assert score == 100
    # Widening tolerance as per review feedback
    assert 90 <= ttfb <= 200

def test_analyze_performance_sim_edge():
    simulated_start = time.time() - 3.05
    score, ttfb = analyze_performance_sim(simulated_start, 300 * 1024)
    assert score == 40
    assert ttfb >= 3000

# --- apps.ctr_tool.score_title ---
def test_score_title_normal():
    t = "Mejor guía completa de SEO para el año 2025 (Gratis y PDF)"
    res = score_title(t)
    assert res['score'] == 100
    assert "Power Words" in res['checks']
    assert "Números" in res['checks']
    assert "Paréntesis" in res['checks']

def test_score_title_edge():
    t = "Hola"
    res = score_title(t)
    assert res['score'] == 50
    assert res['checks'] == []

# --- apps.serp_scanner.is_valid_url ---
def test_is_valid_url_normal():
    assert is_valid_url("https://mysite.com") is True
    assert is_valid_url("http://blog.example.org/post") is True

def test_is_valid_url_blacklist():
    assert is_valid_url("https://www.facebook.com/profile") is False
    assert is_valid_url("https://twitter.com/status") is False
    assert is_valid_url("https://www.amazon.com/product") is False

def test_is_valid_url_edge():
    assert is_valid_url(None) is False
    assert is_valid_url("") is False

# --- apps.schema_detector.extract_types_recursive ---
def test_extract_types_recursive_normal():
    data = {
        "@type": "Article",
        "headline": "News",
        "author": {
            "@type": "Person",
            "name": "John"
        }
    }
    found = set()
    extract_types_recursive(data, found)
    assert found == {"Article", "Person"}

def test_extract_types_recursive_list():
    data = [
        {"@type": "Product", "name": "P1"},
        {"@type": "Offer", "price": "10"}
    ]
    found = set()
    extract_types_recursive(data, found)
    assert found == {"Product", "Offer"}

def test_extract_types_recursive_edge():
    # Empty dict
    found = set()
    extract_types_recursive({}, found)
    assert found == set()

    # List of types
    data = {"@type": ["Organization", "LocalBusiness"]}
    found = set()
    extract_types_recursive(data, found)
    assert found == {"Organization", "LocalBusiness"}

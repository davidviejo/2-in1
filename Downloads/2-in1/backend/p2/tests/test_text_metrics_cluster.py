import pytest
from apps.web.blueprints.readability_tool import count_syllables, analyze_text_visual
from apps.web.blueprints.nlp_tool import get_ngrams
from apps.web.blueprints.schema_detector import extract_types_recursive

# --- apps.readability_tool.count_syllables ---

def test_count_syllables_normal():
    # Simple words
    assert count_syllables("hola") == 2  # o, a
    assert count_syllables("computadora") == 5 # o, u, a, o, a
    assert count_syllables("sol") == 1 # o

def test_count_syllables_edge():
    # Edge cases
    assert count_syllables("") == 0
    assert count_syllables("bcd") == 0 # No vowels
    assert count_syllables("123") == 0

# --- apps.readability_tool.analyze_text_visual ---

def test_analyze_text_visual_normal():
    text = "Hola mundo. Esto es una prueba."
    result = analyze_text_visual(text)

    assert result['stats']['words'] > 0
    assert result['stats']['sentences'] >= 1
    assert "Hola" in result['html']
    assert result['stats']['score'] >= 0

def test_analyze_text_visual_edge():
    # Empty text
    result = analyze_text_visual("")
    assert result['html'] == ""
    assert result['stats'] == {}

    # None input
    result = analyze_text_visual(None)
    assert result['html'] == ""
    assert result['stats'] == {}

# --- apps.nlp_tool.get_ngrams ---

def test_get_ngrams_normal():
    text = "uno dos tres cuatro"
    # n=2 (default). Words > 2 chars kept: "uno", "dos", "tres", "cuatro"
    ngrams = get_ngrams(text, n=2)
    assert "uno dos" in ngrams
    assert "tres cuatro" in ngrams
    assert len(ngrams) == 3

def test_get_ngrams_edge():
    # Empty text
    assert get_ngrams("") == []

    # Short words filtered out (< 3 chars, wait check impl: > 2 means >= 3)
    # "ab" len 2 -> filtered out?
    # Impl: if len(w) > 2. So len 2 is filtered.
    assert get_ngrams("ab cd ef") == []

    # Text with enough words but n is large
    # "uno dos tres", n=4 -> 3 words, needs 4.
    assert get_ngrams("uno dos tres", n=4) == []

# --- apps.schema_detector.extract_types_recursive ---

def test_extract_types_recursive_normal():
    data = {
        "@type": "Product",
        "name": "Shoe",
        "offers": {
            "@type": "Offer",
            "price": "100"
        }
    }
    found = set()
    extract_types_recursive(data, found)
    assert "Product" in found
    assert "Offer" in found
    assert len(found) == 2

def test_extract_types_recursive_list():
    data = [
        {"@type": "Article"},
        {"@type": ["NewsArticle", "TechArticle"]} # List of types
    ]
    found = set()
    extract_types_recursive(data, found)
    assert "Article" in found
    assert "NewsArticle" in found
    assert "TechArticle" in found

def test_extract_types_recursive_edge():
    # Empty dict
    found = set()
    extract_types_recursive({}, found)
    assert len(found) == 0

    # None (handled gracefully by implementation not crashing, or just logic check)
    extract_types_recursive(None, found)
    assert len(found) == 0

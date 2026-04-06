from apps.web.blueprints.readability_tool import count_syllables, analyze_text_visual
from apps.web.blueprints.kw_intent import classify_keyword
from apps.web.blueprints.schema_detector import extract_types_recursive
from apps.web.blueprints.nlp_tool import get_ngrams

# --- Tests for apps/readability_tool.py ---

def test_count_syllables_normal():
    # "casa" has 2 vowels (a, a) -> 2 syllables approx
    assert count_syllables("casa") == 2
    # "murciélago" has 5 vowels (u, i, é, a, o)
    assert count_syllables("murciélago") == 5

def test_count_syllables_edge():
    # Empty string
    assert count_syllables("") == 0
    # No vowels
    assert count_syllables("bcdf") == 0

def test_analyze_text_visual_normal():
    text = "Esto es una frase. Esto es otra frase."
    result = analyze_text_visual(text)

    assert isinstance(result, dict)
    assert 'stats' in result
    assert result['stats']['sentences'] == 2
    assert result['stats']['words'] > 0
    assert 'html' in result

def test_analyze_text_visual_edge():
    # Empty text
    result = analyze_text_visual("")
    assert result['html'] == ''
    assert result['stats'] == {}

# --- Tests for apps/kw_intent.py ---

def test_classify_keyword_transactional():
    result = classify_keyword("comprar iphone barato")
    assert result['intent'] == "Transaccional"
    assert result['color'] == "success"

def test_classify_keyword_informational():
    result = classify_keyword("qué es el seo")
    assert result['intent'] == "Informacional"

def test_classify_keyword_edge():
    # Ambiguous / Unknown
    result = classify_keyword("palabra_rara_sin_sentido")
    assert result['intent'] == "Ambiguo / General"

# --- Tests for apps/schema_detector.py ---

def test_extract_types_recursive_normal():
    data = {
        "@type": "BlogPosting",
        "headline": "Test",
        "author": {
            "@type": "Person",
            "name": "Author Name"
        }
    }
    found_types = set()
    extract_types_recursive(data, found_types)
    assert "BlogPosting" in found_types
    assert "Person" in found_types
    assert len(found_types) == 2

def test_extract_types_recursive_list_handling():
    data = {
        "@type": ["Article", "NewsArticle"]
    }
    found_types = set()
    extract_types_recursive(data, found_types)
    assert "Article" in found_types
    assert "NewsArticle" in found_types

def test_extract_types_recursive_edge():
    data = []
    found_types = set()
    extract_types_recursive(data, found_types)
    assert len(found_types) == 0

# --- Tests for apps/nlp_tool.py ---

def test_get_ngrams_normal():
    text = "el perro corre rápido"
    # words > 2 chars: perro, corre, rápido (el is length 2, wait... "len(w) > 2")
    # "el" is 2 chars. 2 is not > 2. So "el" is excluded.
    # Words: "perro", "corre", "rápido"
    # Bigrams: "perro corre", "corre rápido"
    ngrams = get_ngrams(text, n=2)
    assert "perro corre" in ngrams
    assert "corre rápido" in ngrams
    assert len(ngrams) == 2

def test_get_ngrams_edge():
    # Text with words all <= 2 chars
    text = "el la un de"
    ngrams = get_ngrams(text, n=2)
    assert ngrams == []

    # Empty text
    assert get_ngrams("") == []

import pytest
from apps.web.blueprints.kw_intent import classify_keyword
from apps.web.blueprints.migration_tool import slugify
from apps.web.blueprints.ctr_tool import score_title

# --- Tests for apps/kw_intent.py ---

def test_classify_intent_transactional():
    # "comprar" is a transactional modifier
    result = classify_keyword("comprar zapatos")
    assert result['intent'] == "Transaccional"
    assert result['color'] == "success"

def test_classify_intent_informational():
    # "que es" is an informational modifier
    result = classify_keyword("que es seo")
    assert result['intent'] == "Informacional"

def test_classify_intent_edge_unknown():
    # No known modifiers
    result = classify_keyword("palabra_desconocida_xyz")
    assert result['intent'] == "Ambiguo / General"

def test_classify_intent_edge_empty():
    # Empty string
    result = classify_keyword("")
    assert result['intent'] == "Ambiguo / General"


# --- Tests for apps/migration_tool.py ---

def test_slugify_normal():
    # Accents and spaces
    assert slugify("Hóla Múndo") == "hola-mundo"

def test_slugify_complex():
    # Mixed case and punctuation
    assert slugify("SEO: ¿Qué es?") == "seo-que-es"

def test_slugify_edge_empty_chars():
    # Only special characters should result in empty string
    assert slugify("!!!") == ""
    assert slugify("") == ""


# --- Tests for apps/ctr_tool.py ---

def test_score_title_high():
    # "Mejor" (Power +20), "(2025)" (Numbers +10, Parens +10)
    # Length: 17 (No length bonus, optimal is 40-60)
    # Base: 50.
    # Calculation: 50 + 20 + 10 + 10 = 90.

    title = "Mejor Guía (2025)"
    result = score_title(title)
    assert result['score'] == 90
    assert "Power Words" in result['checks']
    assert "Números" in result['checks']
    assert "Paréntesis" in result['checks']

def test_score_title_optimal_length():
    # 40 chars exactly.
    title = "a" * 40
    # Base 50 + Length 10 = 60
    result = score_title(title)
    assert result['score'] == 60

def test_score_title_edge_short():
    # "A". Base 50.
    result = score_title("A")
    assert result['score'] == 50
    assert result['checks'] == []

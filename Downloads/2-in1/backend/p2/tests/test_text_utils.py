import unittest
from apps.web.blueprints.readability_tool import count_syllables
from apps.tools.utils import normalize
from apps.web.blueprints.kw_intent import classify_keyword
from apps.web.blueprints.nlp_tool import get_ngrams

class TestTextUtils(unittest.TestCase):

    # --- Tests for apps.readability_tool.count_syllables ---
    def test_count_syllables_normal(self):
        # "hola" has 2 syllables (o, a)
        self.assertEqual(count_syllables("hola"), 2)
        # "programación" has 5 syllables (o, a, a, i, o) - approximated by vowel count
        self.assertEqual(count_syllables("programación"), 5)

    def test_count_syllables_edge(self):
        # Empty string
        self.assertEqual(count_syllables(""), 0)
        # Single vowel
        self.assertEqual(count_syllables("a"), 1)
        # No vowels
        self.assertEqual(count_syllables("brrr"), 0)

    # --- Tests for apps.tools.utils.normalize ---
    def test_normalize_normal(self):
        self.assertEqual(normalize("Camión"), "camion")
        self.assertEqual(normalize("Árbol de la Vida"), "arbol de la vida")

    def test_normalize_edge(self):
        # Already normalized
        self.assertEqual(normalize("simple"), "simple")
        # Empty string
        self.assertEqual(normalize(""), "")
        # Special characters are kept?
        # Logic: unicodedata.normalize('NFKD', text.lower()).encode('ascii', 'ignore')
        # 'ñ' becomes 'n' + '~', usually 'n' in ascii ignore if decomposed?
        # Wait, NFKD decomposes 'ñ' into 'n' and combining tilde.
        # encode('ascii', 'ignore') drops the tilde. So 'niño' -> 'nino'.
        self.assertEqual(normalize("niño"), "nino")

    # --- Tests for apps.kw_intent.classify_keyword ---
    def test_classify_keyword_intents(self):
        # Transactional
        res = classify_keyword("comprar iphone")
        self.assertIn("Transaccional", res['intent'])
        self.assertEqual(res['color'], "success")

        # Informational
        res = classify_keyword("cómo hacer pan")
        self.assertIn("Informacional", res['intent'])

        # Commercial
        res = classify_keyword("mejor móvil 2023")
        self.assertIn("Comercial", res['intent'])

        # Navigational
        res = classify_keyword("facebook login")
        self.assertIn("Navegacional", res['intent'])

    def test_classify_keyword_edge(self):
        # Ambiguous / General
        res = classify_keyword("mesa")
        self.assertIn("Ambiguo", res['intent'])

        # Empty string handled gracefully by logic (returns Ambiguo usually or handled by caller?)
        # Logic: kw.lower().strip(). If empty string, no keywords match.
        res = classify_keyword("")
        self.assertIn("Ambiguo", res['intent'])

    # --- Tests for apps.nlp_tool.get_ngrams ---
    def test_get_ngrams_normal(self):
        text = "uno dos tres cuatro"
        ngrams = get_ngrams(text, n=2)
        # ["uno dos", "dos tres", "tres cuatro"]
        self.assertEqual(len(ngrams), 3)
        self.assertEqual(ngrams[0], "uno dos")
        self.assertEqual(ngrams[-1], "tres cuatro")

    def test_get_ngrams_edge(self):
        # Text shorter than n
        text = "uno"
        ngrams = get_ngrams(text, n=2)
        self.assertEqual(ngrams, [])

        # Empty text
        self.assertEqual(get_ngrams("", n=2), [])

        # n=1
        ngrams = get_ngrams("uno dos", n=1)
        self.assertEqual(ngrams, ["uno", "dos"])

if __name__ == '__main__':
    unittest.main()

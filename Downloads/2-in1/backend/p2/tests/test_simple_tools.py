import unittest
from unittest.mock import patch, MagicMock
from apps.web.blueprints.local_nap import check as check_nap
from apps.web.blueprints.intent_tool import classify as classify_intent
from apps.web.blueprints.link_health import check as check_health

class TestSimpleTools(unittest.TestCase):

    @patch('apps.web.blueprints.local_nap.is_safe_url')
    @patch('apps.web.blueprints.local_nap.requests.get')
    def test_nap_check_success(self, mock_get, mock_is_safe):
        mock_is_safe.return_value = True

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.content = b'<html><body>My Business Name Phone: 555-123-4567</body></html>'
        mock_get.return_value = mock_resp

        # Test matching name and phone
        result = check_nap('http://example.com', 'Business Name', '555-123-4567', '123 Fake St')

        self.assertEqual(result['status'], 'OK')
        self.assertIn('Nombre', result['matches'])
        self.assertIn('Teléfono', result['matches'])
        self.assertTrue(result['score'] >= 70)

    @patch('apps.web.blueprints.local_nap.is_safe_url')
    def test_nap_unsafe_url(self, mock_is_safe):
        mock_is_safe.return_value = False
        result = check_nap('http://unsafe.com', 'Name', 'Phone', 'Address')
        self.assertEqual(result['status'], 'URL no permitida')

    @patch('apps.web.blueprints.intent_tool.is_safe_url')
    @patch('apps.web.blueprints.intent_tool.requests.get')
    def test_intent_classify_transitional(self, mock_get, mock_is_safe):
        mock_is_safe.return_value = True

        mock_resp = MagicMock()
        mock_resp.text = "buy this product price is low add to cart"
        mock_get.return_value = mock_resp

        result = classify_intent('http://shop.com')
        self.assertEqual(result['type'], 'Transaccional')
        self.assertGreater(result['confidence'], 0)

    @patch('apps.web.blueprints.intent_tool.is_safe_url')
    @patch('apps.web.blueprints.intent_tool.requests.get')
    def test_intent_classify_error(self, mock_get, mock_is_safe):
        mock_is_safe.return_value = True
        mock_get.side_effect = Exception("Network error")

        result = classify_intent('http://error.com')
        # Currently it catches exception and returns default
        self.assertEqual(result['type'], '?')
        self.assertEqual(result['confidence'], 0)

    @patch('apps.web.blueprints.link_health.is_safe_url')
    @patch('apps.web.blueprints.link_health.requests.head')
    def test_health_check_ok(self, mock_head, mock_is_safe):
        mock_is_safe.return_value = True
        mock_head.return_value.status_code = 200

        result = check_health('http://ok.com')
        self.assertEqual(result['status'], 200)

    @patch('apps.web.blueprints.link_health.is_safe_url')
    @patch('apps.web.blueprints.link_health.requests.head')
    def test_health_check_fail(self, mock_head, mock_is_safe):
        mock_is_safe.return_value = True
        mock_head.side_effect = Exception("Boom")

        result = check_health('http://fail.com')
        self.assertEqual(result['status'], 'Err')

import unittest
from unittest.mock import patch, MagicMock
import os
import sys
import json

# Add project root to path
sys.path.append(os.getcwd())

from flask import Flask

# We need to ensure we can import the blueprint.
# Depending on how apps is structured, this might trigger other imports.
try:
    from apps.web.blueprints.api_engine import api_engine_bp
except ImportError:
    # If apps package is not straightforward, we might need to mock some things
    # But let's assume it works for now as we are in the repo root.
    pass

class TestCapabilitiesAndLimits(unittest.TestCase):

    def setUp(self):
        self.app = Flask(__name__)
        try:
            from apps.web.blueprints.api_engine import api_engine_bp
            self.app.register_blueprint(api_engine_bp)
        except Exception as e:
            print(f"Failed to register blueprint: {e}")
        self.client = self.app.test_client()

    @patch('apps.web.blueprints.api_engine.routes.get_user_settings')
    @patch.dict(os.environ, {}, clear=True)
    def test_capabilities_defaults(self, mock_settings):
        mock_settings.return_value = {}
        response = self.client.get('/api/capabilities')
        self.assertEqual(response.status_code, 200)
        data = response.json

        self.assertFalse(data['serpProviders']['serpapi'])
        self.assertFalse(data['serpProviders']['dataforseo'])
        self.assertTrue(data['serpProviders']['internal'])

        # Check default limits
        self.assertEqual(data['limits']['maxKeywordsPerUrl'], 20)
        self.assertEqual(data['limits']['maxCompetitorsPerKeyword'], 5)
        self.assertEqual(data['limits']['maxUrlsPerBatch'], 100)

    @patch('apps.web.blueprints.api_engine.routes.get_user_settings')
    @patch.dict(os.environ, {
        'SERPAPI_KEY': 'env_key'
    }, clear=True)
    def test_capabilities_env(self, mock_settings):
        mock_settings.return_value = {}
        self.app.config['ENGINE_MAX_KEYWORDS_PER_URL'] = 50
        response = self.client.get('/api/capabilities')
        data = response.json

        self.assertTrue(data['serpProviders']['serpapi'])
        self.assertEqual(data['limits']['maxKeywordsPerUrl'], 50)

    @patch('apps.web.blueprints.api_engine.seo_checklist_orchestrator.get_user_settings')
    @patch('apps.web.blueprints.api_engine.seo_checklist_orchestrator.fetch_url_hybrid')
    @patch('apps.web.blueprints.api_engine.seo_checklist_orchestrator.check_url_compliance')
    def test_analyze_limits(self, mock_compliance, mock_fetch, mock_settings):
        # Mock basics
        mock_fetch.return_value = {'content': '<html></html>'}
        mock_compliance.return_value = {}
        mock_settings.return_value = {'serpapi_key': 'db_key'}

        payload = {
            'url': 'http://example.com',
            'kwPrincipal': 'test',
            'analysisConfig': {
                'mode': 'advanced',
                'serp': {
                    'confirmed': True,
                    'provider': 'serpapi',
                    'maxKeywordsPerUrl': 100, # Requesting 100
                    'maxCompetitorsPerKeyword': 10 # Requesting 10
                }
            }
        }

        with patch('apps.web.blueprints.api_engine.seo_checklist_orchestrator.check_px') as m_px, \
             patch('apps.web.blueprints.api_engine.seo_checklist_orchestrator.get_struct') as m_struct, \
             patch('apps.web.blueprints.api_engine.seo_checklist_orchestrator.check_wpo') as m_wpo, \
             patch('apps.web.blueprints.api_engine.seo_checklist_orchestrator.detect_schemas') as m_schema, \
             patch('apps.web.blueprints.api_engine.seo_checklist_orchestrator.scan_imgs') as m_imgs, \
             patch('apps.web.blueprints.api_engine.seo_checklist_orchestrator.analyze_text_visual') as m_readability, \
             patch('apps.web.blueprints.api_engine.seo_checklist_orchestrator.classify_keyword') as m_intent, \
             patch('apps.web.blueprints.api_engine.seo_checklist_orchestrator.dispatcher') as m_dispatcher, \
             patch('apps.web.blueprints.api_engine.seo_checklist_orchestrator.scrape_page') as m_scrape:

            m_px.return_value = {}
            m_struct.return_value = {}
            m_wpo.return_value = {}
            m_schema.return_value = {}
            m_imgs.return_value = {}
            m_readability.return_value = {}
            m_intent.return_value = {}
            m_dispatcher.return_value = [] # Return empty list to avoid processing
            m_scrape.return_value = {}

            # Set App Config limits
            self.app.config['ENGINE_MAX_KEYWORDS_PER_URL'] = 30
            self.app.config['ENGINE_MAX_COMPETITORS_PER_KEYWORD'] = 4

            response = self.client.post('/api/analyze', json=payload)
            self.assertEqual(response.status_code, 200)
            data = response.json

            self.assertIn('appliedLimits', data)
            # Should be min(100, 30) = 30
            self.assertEqual(data['appliedLimits']['maxKeywordsPerUrl'], 30)
            # Should be min(10, 4) = 4
            self.assertEqual(data['appliedLimits']['maxCompetitorsPerKeyword'], 4)

            self.assertEqual(data.get('providerUsed'), 'serpapi')
            self.assertTrue(data.get('advancedExecuted'))

    @patch('apps.web.blueprints.api_engine.seo_checklist_orchestrator.get_user_settings')
    @patch('apps.web.blueprints.api_engine.seo_checklist_orchestrator.fetch_url_hybrid')
    def test_analyze_block_missing_creds(self, mock_fetch, mock_settings):
        mock_fetch.return_value = {'content': '<html></html>'}
        mock_settings.return_value = {} # No keys

        payload = {
            'url': 'http://example.com',
            'kwPrincipal': 'test',
            'analysisConfig': {
                'mode': 'advanced',
                'serp': {
                    'confirmed': True,
                    'provider': 'serpapi'
                }
            }
        }

        # Need to mock tools again
        with patch('apps.web.blueprints.api_engine.seo_checklist_orchestrator.check_url_compliance') as m_check, \
             patch('apps.web.blueprints.api_engine.seo_checklist_orchestrator.check_px') as m_px, \
             patch('apps.web.blueprints.api_engine.seo_checklist_orchestrator.get_struct') as m_struct, \
             patch('apps.web.blueprints.api_engine.seo_checklist_orchestrator.check_wpo') as m_wpo, \
             patch('apps.web.blueprints.api_engine.seo_checklist_orchestrator.detect_schemas') as m_schema, \
             patch('apps.web.blueprints.api_engine.seo_checklist_orchestrator.scan_imgs') as m_imgs, \
             patch('apps.web.blueprints.api_engine.seo_checklist_orchestrator.analyze_text_visual') as m_readability, \
             patch('apps.web.blueprints.api_engine.seo_checklist_orchestrator.classify_keyword') as m_intent:

             m_check.return_value = {}
             m_px.return_value = {}
             m_struct.return_value = {}
             m_wpo.return_value = {}
             m_schema.return_value = {}
             m_imgs.return_value = {}
             m_readability.return_value = {}
             m_intent.return_value = {}

             with patch.dict(os.environ, {}, clear=True):
                 response = self.client.post('/api/analyze', json=payload)
                 self.assertEqual(response.status_code, 200)
                 data = response.json

                 self.assertFalse(data.get('advancedExecuted'))
                 self.assertIn("Provider 'serpapi' credentials missing", data.get('advancedBlockedReason', ''))

if __name__ == '__main__':
    unittest.main()

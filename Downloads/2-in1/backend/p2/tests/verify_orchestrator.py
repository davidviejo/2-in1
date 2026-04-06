import sys
import os
import unittest
from unittest.mock import patch, MagicMock

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from apps.web.blueprints.api_engine.seo_checklist_orchestrator import run_orchestrated_checklist

class TestOrchestrator(unittest.TestCase):

    @patch('apps.web.blueprints.api_engine.seo_checklist_orchestrator.fetch_url_hybrid')
    @patch('apps.web.blueprints.api_engine.seo_checklist_orchestrator.check_url_compliance')
    @patch('apps.web.blueprints.api_engine.seo_checklist_orchestrator.check_px')
    @patch('apps.web.blueprints.api_engine.seo_checklist_orchestrator.get_struct')
    @patch('apps.web.blueprints.api_engine.seo_checklist_orchestrator.check_wpo')
    @patch('apps.web.blueprints.api_engine.seo_checklist_orchestrator.detect_schemas')
    @patch('apps.web.blueprints.api_engine.seo_checklist_orchestrator.scan_imgs')
    @patch('apps.web.blueprints.api_engine.seo_checklist_orchestrator.analyze_text_visual')
    @patch('apps.web.blueprints.api_engine.seo_checklist_orchestrator.classify_keyword')
    def test_run_orchestrator(self, mock_classify, mock_readability, mock_imgs, mock_schema, mock_wpo, mock_struct, mock_px, mock_checklist, mock_fetch):

        # Setup mocks
        mock_fetch.return_value = {
            'content': '''<html><head><title>Test Page</title></head><body>
                <h1>H1 Title</h1>
                <p>Some content with keyword.</p>
                <img src="img.jpg" alt="test">
                <a href="/internal1">Internal Link 1</a>
                <a href="http://example.com/internal2" rel="nofollow">Internal Link 2</a>
                <a href="http://external.com">External Link</a>
            </body></html>'''
        }

        mock_checklist.return_value = {
            'summary': {'Geolocalización': 'NO', 'Enlazado Interno': '5'},
            'snippet': {'Title': 'Test Page', 'Desc': 'Description'},
            'images': []
        }

        mock_px.return_value = {'t_px': 200, 'd_px': 400, 't_stat': 'OK', 'd_stat': 'OK'}
        mock_struct.return_value = {'headers': [{'tag': 'H1', 'txt': 'H1 Title'}]}
        mock_wpo.return_value = {'size': 50, 'ttfb': 0.2}
        mock_schema.return_value = {'total_count': 1, 'status': 'OK', 'json_ld_types': ['Article']}
        mock_imgs.return_value = {'images': [{'src': 'img.jpg', 'alt': 'test'}]}
        mock_readability.return_value = {'stats': {'score': 70, 'level': 'Normal', 'words': 100}}
        mock_classify.return_value = {'intent': 'Informacional'}

        # Run orchestrator
        result = run_orchestrated_checklist(
            url="http://example.com",
            kwPrincipal="keyword",
            pageType="Landing",
            geoTarget="Madrid",
            cluster="Cluster A"
        )

        # Assertions
        self.assertIsInstance(result, dict)
        expected_keys = [
            "CLUSTER", "GEOLOCALIZACION", "DATOS_ESTRUCTURADOS", "CONTENIDOS",
            "SNIPPETS", "IMAGENES", "ENLAZADO_INTERNO", "ESTRUCTURA", "UX",
            "WPO", "ENLACE", "OPORTUNIDADES_VS_KW_OBJETIVO", "SEMANTICA",
            "GEOLOCALIZACION_IMAGENES", "LLAMADA_A_LA_ACCION"
        ]
        for key in expected_keys:
            self.assertIn(key, result)
            self.assertIsInstance(result[key], dict)
            # Check for error handling
            if 'error' in result[key]:
                print(f"Warning: {key} returned error: {result[key]['error']}")
            else:
                self.assertIn('autoData', result[key])
                self.assertIn('recommendation', result[key])
                self.assertIn('status', result[key])

        # Verify specific values
        self.assertEqual(result['CLUSTER']['autoData']['cluster_input'], 'Cluster A')
        self.assertEqual(result['ESTRUCTURA']['autoData']['h1_count'], 1)
        self.assertEqual(result['SNIPPETS']['autoData']['pixel_title'], 200)
        self.assertEqual(result['CONTENIDOS']['autoData']['readability_score'], 70)

        # Verify Internal Links (New Feature)
        internal_data = result['ENLAZADO_INTERNO']['autoData']
        self.assertEqual(internal_data['internal_links_count'], 2)
        self.assertEqual(len(internal_data['internal_links']), 2)

        # Check details of first link (relative resolved to absolute)
        link1 = internal_data['internal_links'][0]
        self.assertEqual(link1['href'], 'http://example.com/internal1')
        self.assertEqual(link1['anchor'], 'Internal Link 1')
        self.assertEqual(link1['is_nofollow'], False)

        # Check details of second link (absolute, nofollow)
        link2 = internal_data['internal_links'][1]
        self.assertEqual(link2['href'], 'http://example.com/internal2')
        self.assertEqual(link2['is_nofollow'], True)
        self.assertIn('nofollow', link2['rel'])

        print("\nSuccess test passed! Result keys verified.")

    @patch('apps.web.blueprints.api_engine.seo_checklist_orchestrator.fetch_url_hybrid')
    @patch('apps.web.blueprints.api_engine.seo_checklist_orchestrator.check_url_compliance')
    @patch('apps.web.blueprints.api_engine.seo_checklist_orchestrator.check_px')
    @patch('apps.web.blueprints.api_engine.seo_checklist_orchestrator.get_struct')
    @patch('apps.web.blueprints.api_engine.seo_checklist_orchestrator.check_wpo')
    @patch('apps.web.blueprints.api_engine.seo_checklist_orchestrator.detect_schemas')
    @patch('apps.web.blueprints.api_engine.seo_checklist_orchestrator.scan_imgs')
    @patch('apps.web.blueprints.api_engine.seo_checklist_orchestrator.analyze_text_visual')
    @patch('apps.web.blueprints.api_engine.seo_checklist_orchestrator.classify_keyword')
    def test_tool_failure(self, mock_classify, mock_readability, mock_imgs, mock_schema, mock_wpo, mock_struct, mock_px, mock_checklist, mock_fetch):
        # Mock fetch
        mock_fetch.return_value = {'content': '<html></html>'}

        # Mock failure for pixel tool
        mock_px.side_effect = Exception("Pixel Tool Failed")

        # Provide valid return for others to ensure only one fails
        mock_checklist.return_value = {'summary': {}, 'snippet': {}}
        mock_struct.return_value = {'headers': []}
        mock_wpo.return_value = {}
        mock_schema.return_value = {}
        mock_imgs.return_value = {'images': []}
        mock_readability.return_value = {'stats': {}}
        mock_classify.return_value = {}

        result = run_orchestrated_checklist(
            url="http://example.com",
            kwPrincipal="test",
            pageType="test"
        )

        self.assertIn('error', result['SNIPPETS'])
        self.assertEqual(result['SNIPPETS']['error'], "Pixel Tool Failed")
        # Other items should not have error (or at least not THIS error)
        self.assertNotIn('error', result['ESTRUCTURA'])

        print("\nFailure test passed! Error handled correctly.")

if __name__ == '__main__':
    unittest.main()

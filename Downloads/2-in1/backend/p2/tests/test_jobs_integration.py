import unittest
import json
import time
import os
from unittest.mock import patch, MagicMock
from apps.web import create_app
from apps.core.database import init_db, get_db_connection

class TestJobsIntegration(unittest.TestCase):
    def setUp(self):
        # Use a temporary DB
        self.db_path = 'test_projects.db'
        # Patch the DB_FILE in apps.core.database
        self.patcher = patch('apps.core.database.DB_FILE', self.db_path)
        self.patcher.start()

        # Initialize app
        self.app = create_app()
        self.client = self.app.test_client()

        # Init DB
        init_db()

    def tearDown(self):
        self.patcher.stop()
        if os.path.exists(self.db_path):
            try:
                os.remove(self.db_path)
            except:
                pass

    @patch('apps.job_runner.JobRunner.start_worker')
    def test_create_job(self, mock_start_worker):
        payload = {
            "urls": [{"url": "https://example.com", "kwPrincipal": "test"}],
            "analysisConfig": {"mode": "quick"}
        }
        response = self.client.post('/api/jobs', json=payload)
        self.assertEqual(response.status_code, 201)
        data = response.get_json()
        self.assertIn('jobId', data)
        self.assertEqual(data['status'], 'queued')
        self.assertEqual(data['total'], 1)

        # Verify DB insertion
        conn = get_db_connection()
        c = conn.cursor()
        c.execute("SELECT * FROM analysis_jobs WHERE job_id = ?", (data['jobId'],))
        job = c.fetchone()
        self.assertIsNotNone(job)
        conn.close()

    @patch('apps.job_runner.JobRunner.start_worker')
    @patch('apps.job_runner.run_orchestrated_checklist')
    def test_job_execution(self, mock_orchestrator, mock_start_worker):
        # Mock orchestrator response
        mock_orchestrator.return_value = {
            "OPORTUNIDADES": {"suggested_status": "SI", "recommendation": "OK"}
        }

        # Create job
        payload = {
            "urls": [{"url": "https://example.com", "kwPrincipal": "test"}],
            "analysisConfig": {"mode": "quick"}
        }
        response = self.client.post('/api/jobs', json=payload)
        job_id = response.get_json()['jobId']

        # Manually trigger runner loop step
        from apps.job_runner import JobRunner
        from apps.core.database import get_next_queued_job

        job = get_next_queued_job()
        self.assertIsNotNone(job)
        self.assertEqual(job['job_id'], job_id)

        JobRunner.process_job(job)

        # Check status
        response = self.client.get(f'/api/jobs/{job_id}')
        data = response.get_json()
        self.assertEqual(data['status'], 'completed')
        self.assertEqual(data['processed'], 1)
        self.assertEqual(data['success'], 1)

        # Check item result
        response = self.client.get(f'/api/jobs/{job_id}/items')
        data = response.get_json()
        self.assertEqual(len(data['items']), 1)
        item_id = data['items'][0]['item_id']
        self.assertEqual(data['items'][0]['status'], 'done')

        # Check result detail
        response = self.client.get(f'/api/jobs/{job_id}/items/{item_id}/result')
        data = response.get_json()
        self.assertIn('pageId', data)
        self.assertIn('items', data)
        self.assertEqual(data['pageId'], item_id)
        self.assertIn('OPORTUNIDADES', data['items'])

    @patch('apps.job_runner.JobRunner.start_worker')
    @patch('apps.job_runner.run_orchestrated_checklist')
    def test_item_gsc_queries_take_precedence_over_legacy_map(self, mock_orchestrator, mock_start_worker):
        mock_orchestrator.return_value = {"status": "GOOD", "summary": "Test result"}

        item_level_queries = [
            {"query": "item query 1", "clicks": 10, "impressions": 100},
            {"query": "item query 2", "clicks": 5, "impressions": 80}
        ]
        legacy_map_queries = [
            {"query": "legacy query", "clicks": 1, "impressions": 20}
        ]

        payload = {
            "items": [{
                "url": "https://example.com",
                "kwPrincipal": "test",
                "gscQueries": item_level_queries
            }],
            "gscQueriesByUrl": {
                "https://example.com": legacy_map_queries
            },
            "analysisConfig": {"mode": "quick"}
        }

        response = self.client.post('/api/jobs', json=payload)
        self.assertEqual(response.status_code, 201)
        job_id = response.get_json()['jobId']

        from apps.job_runner import JobRunner
        from apps.core.database import get_next_queued_job

        job = get_next_queued_job()
        self.assertIsNotNone(job)
        self.assertEqual(job['job_id'], job_id)

        JobRunner.process_job(job)

        mock_orchestrator.assert_called_once()
        self.assertEqual(
            mock_orchestrator.call_args.kwargs.get('gscQueries'),
            item_level_queries
        )

    @patch('apps.job_runner.JobRunner.start_worker')
    def test_cost_guardrail(self, mock_start_worker):
        # Test advanced mode blocking
        payload = {
            "urls": [{"url": "https://example.com"}],
            "analysisConfig": {
                "mode": "advanced",
                "serp": {
                    "confirmed": True,
                    "provider": "serpapi",
                    "maxKeywordsPerUrl": 10000 # High cost
                }
            }
        }

        # Mock settings to return keys. Note: patching where it is used.
        with patch('apps.web.blueprints.api_engine.job_routes.get_user_settings', return_value={'serpapi_key': 'test'}):
            # Patch environment variable for max cost
            with patch.dict(os.environ, {'ENGINE_MAX_ESTIMATED_COST_PER_BATCH': '1.0'}):
                 response = self.client.post('/api/jobs', json=payload)
                 self.assertEqual(response.status_code, 201)
                 data = response.get_json()
                 self.assertFalse(data['advancedAllowed'])
                 self.assertIn('exceeds batch limit', data['advancedBlockedReason'])

if __name__ == '__main__':
    unittest.main()

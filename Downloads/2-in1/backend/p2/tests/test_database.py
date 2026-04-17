import unittest
import os
import tempfile
from apps.core.database import (
    init_db,
    upsert_project,
    get_project,
    replace_clusters,
    delete_project,
    upsert_user_settings,
    get_user_settings,
    ENCRYPTED_VALUE_PREFIX,
)
import apps.core.database

class TestDatabase(unittest.TestCase):
    def setUp(self):
        # Create a temporary file for the database
        self.db_fd, self.db_path = tempfile.mkstemp()
        self.original_settings_key = os.environ.get('SETTINGS_ENCRYPTION_KEY')
        os.environ['SETTINGS_ENCRYPTION_KEY'] = 'test-settings-key-for-db-tests'
        apps.core.database._get_settings_cipher.cache_clear()
        apps.core.database.get_user_settings.cache_clear()

        # Monkey patch the database module to use the temporary DB file
        self.original_db_file = apps.core.database.DB_FILE
        apps.core.database.DB_FILE = self.db_path

        # Initialize the test database
        init_db()

    def tearDown(self):
        # Close the file descriptor
        os.close(self.db_fd)

        # Restore the original DB file path
        apps.core.database.DB_FILE = self.original_db_file

        # Remove the temporary database file
        if os.path.exists(self.db_path):
            os.remove(self.db_path)

        if self.original_settings_key is None:
            os.environ.pop('SETTINGS_ENCRYPTION_KEY', None)
        else:
            os.environ['SETTINGS_ENCRYPTION_KEY'] = self.original_settings_key
        apps.core.database._get_settings_cipher.cache_clear()
        apps.core.database.get_user_settings.cache_clear()

    def test_crud_project(self):
        # Create
        p_data = {
            'id': '1', 'name': 'Test P1', 'domain': 'd1.com',
            'geo': 'US', 'competitors': '', 'brand_name': '',
            'sitemap_url': '', 'business_type': 'blog'
        }
        upsert_project(p_data)

        # Read
        p = get_project('1')
        self.assertIsNotNone(p)
        self.assertEqual(p['name'], 'Test P1')

        # Update
        p_data['name'] = 'Updated P1'
        upsert_project(p_data)
        p = get_project('1')
        self.assertEqual(p['name'], 'Updated P1')

        # Delete
        delete_project('1')
        p = get_project('1')
        self.assertIsNone(p)

    def test_clusters(self):
        p_id = '2'
        upsert_project({'id': p_id, 'name': 'P2'})

        clusters = [
            {'name': 'C1', 'url': 'u1', 'target_kw': 'k1'},
            {'name': 'C2', 'url': 'u2', 'target_kw': 'k2'}
        ]
        replace_clusters(p_id, clusters)

        p = get_project(p_id)
        self.assertEqual(len(p['clusters']), 2)
        self.assertEqual(p['clusters'][0]['name'], 'C1')

        # Replace with empty
        replace_clusters(p_id, [])
        p = get_project(p_id)
        self.assertEqual(len(p['clusters']), 0)

    def test_user_settings_sensitive_values_are_encrypted_at_rest(self):
        upsert_user_settings('default', {
            'default_model': 'gpt-4o-mini',
            'openai_key': 'sk-live-openai',
            'anthropic_key': 'ant-live',
            'dataforseo_password': 'dfs-secret',
            'serpapi_key': 'serp-secret',
            'google_cse_key': 'google-cse-secret',
            'dataforseo_login': 'dfs-user',
        })

        # API returns decrypted plaintext values.
        settings = get_user_settings('default')
        self.assertEqual(settings['openai_key'], 'sk-live-openai')
        self.assertEqual(settings['anthropic_key'], 'ant-live')
        self.assertEqual(settings['dataforseo_password'], 'dfs-secret')
        self.assertEqual(settings['serpapi_key'], 'serp-secret')
        self.assertEqual(settings['google_cse_key'], 'google-cse-secret')

        # Database stores ciphertext for sensitive columns.
        conn = apps.core.database.get_db_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                '''
                SELECT openai_key, anthropic_key, dataforseo_password, serpapi_key, google_cse_key
                FROM user_settings WHERE user_id = ?
                ''',
                ('default',),
            )
            row = cursor.fetchone()
        finally:
            conn.close()

        self.assertTrue(str(row['openai_key']).startswith(ENCRYPTED_VALUE_PREFIX))
        self.assertTrue(str(row['anthropic_key']).startswith(ENCRYPTED_VALUE_PREFIX))
        self.assertTrue(str(row['dataforseo_password']).startswith(ENCRYPTED_VALUE_PREFIX))
        self.assertTrue(str(row['serpapi_key']).startswith(ENCRYPTED_VALUE_PREFIX))
        self.assertTrue(str(row['google_cse_key']).startswith(ENCRYPTED_VALUE_PREFIX))

    def test_init_db_migrates_existing_plaintext_sensitive_settings(self):
        conn = apps.core.database.get_db_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                '''
                INSERT INTO user_settings (
                    user_id, openai_key, anthropic_key, dataforseo_password, serpapi_key, google_cse_key
                ) VALUES (?, ?, ?, ?, ?, ?)
                ''',
                ('legacy', 'legacy-openai', 'legacy-anthropic', 'legacy-dfs', 'legacy-serp', 'legacy-google'),
            )
            conn.commit()
        finally:
            conn.close()

        init_db()

        settings = get_user_settings('legacy')
        self.assertEqual(settings['openai_key'], 'legacy-openai')
        self.assertEqual(settings['anthropic_key'], 'legacy-anthropic')
        self.assertEqual(settings['dataforseo_password'], 'legacy-dfs')
        self.assertEqual(settings['serpapi_key'], 'legacy-serp')
        self.assertEqual(settings['google_cse_key'], 'legacy-google')

if __name__ == '__main__':
    unittest.main()

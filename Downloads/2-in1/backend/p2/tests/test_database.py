import unittest
import os
import tempfile
from apps.core.database import (
    init_db,
    upsert_project,
    get_project,
    replace_clusters,
    delete_project
)
import apps.core.database

class TestDatabase(unittest.TestCase):
    def setUp(self):
        # Create a temporary file for the database
        self.db_fd, self.db_path = tempfile.mkstemp()

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

if __name__ == '__main__':
    unittest.main()

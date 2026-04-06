import unittest
from unittest.mock import MagicMock
import os
import sqlite3
import sys
import re

# Ensure backend/p2 is in path so we can import apps.core.database directly
# as the code in database.py uses relative imports or assumes specific path structure
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Mocking psycopg2 for testing even if not installed
sys.modules['psycopg2'] = MagicMock()
sys.modules['psycopg2.extras'] = MagicMock()

# Import the module now
import importlib.util
spec = importlib.util.spec_from_file_location("database", os.path.join(os.path.dirname(__file__), '../apps/core/database.py'))
database = importlib.util.module_from_spec(spec)
spec.loader.exec_module(database)

class TestDBAbstraction(unittest.TestCase):
    def setUp(self):
        pass

    def test_sqlite_connection(self):
        """Test that get_db_connection returns a sqlite connection by default"""
        database.USE_POSTGRES = False
        conn = database.get_db_connection()
        self.assertIsInstance(conn, sqlite3.Connection)
        conn.close()

    def test_postgres_placeholder_replacement(self):
        """Test that the Postgres wrapper replaces ? with %s"""
        mock_cursor = MagicMock()
        wrapper = database.PostgresCursorWrapper(mock_cursor)

        # Test basic execute
        wrapper.execute("SELECT * FROM table WHERE id = ?", (1,))
        mock_cursor.execute.assert_called_with("SELECT * FROM table WHERE id = %s", (1,))

        # Test execute with ignore quotes
        wrapper.execute("SELECT * FROM table WHERE title = 'Who?' AND id = ?", (1,))
        # Should replace the second ? but not the one in quotes
        mock_cursor.execute.assert_called_with("SELECT * FROM table WHERE title = 'Who?' AND id = %s", (1,))

        # Test executemany
        wrapper.executemany("INSERT INTO table VALUES (?)", [(1,), (2,)])
        mock_cursor.executemany.assert_called_with("INSERT INTO table VALUES (%s)", [(1,), (2,)])

if __name__ == '__main__':
    unittest.main()

import time
import os
import sys
import sqlite3
import json
import tempfile
from contextlib import contextmanager

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import apps.core.database

# Configuration for benchmark
NUM_PROJECTS = 500
CLUSTERS_PER_PROJECT = 20

@contextmanager
def patch_env():
    """Creates temp DB and JSON files and patches apps.core.database"""
    db_fd, db_path = tempfile.mkstemp(suffix='.db')
    os.close(db_fd)

    json_fd, json_path = tempfile.mkstemp(suffix='.json')
    os.close(json_fd)

    original_db_file = apps.core.database.DB_FILE
    original_json_file = apps.core.database.JSON_SOURCE_FILE

    apps.core.database.DB_FILE = db_path
    apps.core.database.JSON_SOURCE_FILE = json_path

    try:
        yield db_path, json_path
    finally:
        apps.core.database.DB_FILE = original_db_file
        apps.core.database.JSON_SOURCE_FILE = original_json_file
        if os.path.exists(db_path):
            os.remove(db_path)
        if os.path.exists(json_path):
            os.remove(json_path)

def generate_json_data():
    projects = []
    for i in range(NUM_PROJECTS):
        p = {
            'id': str(i),
            'name': f"Project {i}",
            'domain': f"domain{i}.com",
            'geo': "US",
            'competitors': "",
            'brand_name': f"Brand {i}",
            'sitemap_url': "",
            'business_type': "blog",
            'clusters': []
        }
        for j in range(CLUSTERS_PER_PROJECT):
            p['clusters'].append({
                'name': f"Cluster {j}",
                'url': f"http://domain{i}.com/cluster-{j}",
                'target_kw': f"keyword {j}"
            })
        projects.append(p)
    return projects

def run_benchmark():
    print(f"--- Benchmarking migrate_from_json ---")
    print(f"Dataset: {NUM_PROJECTS} Projects, {NUM_PROJECTS * CLUSTERS_PER_PROJECT} Clusters")

    with patch_env() as (db_path, json_path):
        # 1. Prepare JSON file
        print("Generating JSON data...")
        data = generate_json_data()
        with open(json_path, 'w') as f:
            json.dump(data, f)

        # 2. Init tables manually to isolate migration time from table creation
        conn = sqlite3.connect(db_path)
        c = conn.cursor()
        c.execute('''
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                domain TEXT,
                geo TEXT,
                competitors TEXT,
                brand_name TEXT,
                sitemap_url TEXT,
                business_type TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        c.execute('''
            CREATE TABLE IF NOT EXISTS clusters (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id TEXT NOT NULL,
                name TEXT,
                url TEXT,
                target_kw TEXT,
                FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
            )
        ''')
        conn.commit()
        conn.close()

        print("Starting migration...")
        start_time = time.time()
        apps.core.database.migrate_from_json()
        end_time = time.time()

        total_time = end_time - start_time
        print(f"Migration time: {total_time:.4f}s")

        # Verify
        conn = sqlite3.connect(db_path)
        c = conn.cursor()
        c.execute("SELECT COUNT(*) FROM projects")
        p_count = c.fetchone()[0]
        c.execute("SELECT COUNT(*) FROM clusters")
        c_count = c.fetchone()[0]
        conn.close()

        print(f"Verified: {p_count} projects, {c_count} clusters")
        assert p_count == NUM_PROJECTS
        assert c_count == NUM_PROJECTS * CLUSTERS_PER_PROJECT
        print("✅ Data verification passed")

if __name__ == "__main__":
    run_benchmark()

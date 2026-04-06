import time
import os
import sys
import sqlite3
import tempfile
from contextlib import contextmanager

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import apps.core.database

# Configuration for benchmark
NUM_PROJECTS = 500
CLUSTERS_PER_PROJECT = 20

@contextmanager
def patch_db_file():
    """Creates a temp DB file and patches apps.core.database.DB_FILE"""
    fd, temp_path = tempfile.mkstemp(suffix='.db')
    os.close(fd)

    original_db_file = apps.core.database.DB_FILE
    apps.core.database.DB_FILE = temp_path

    # Initialize schema
    apps.core.database.init_db()

    try:
        yield temp_path
    finally:
        apps.core.database.DB_FILE = original_db_file
        if os.path.exists(temp_path):
            os.remove(temp_path)

def seed_data(conn):
    """Seeds the database with a large number of projects and clusters using direct SQL for speed."""
    c = conn.cursor()

    # Clear existing data (from potential migration)
    c.execute("DELETE FROM clusters")
    c.execute("DELETE FROM projects")

    projects_data = []
    clusters_data = []

    for i in range(NUM_PROJECTS):
        p_id = str(i)
        projects_data.append((
            p_id,
            f"Project {i}",
            f"domain{i}.com",
            "US",
            "",
            f"Brand {i}",
            "",
            "blog"
        ))

        for j in range(CLUSTERS_PER_PROJECT):
            clusters_data.append((
                p_id,
                f"Cluster {j} for P{i}",
                f"http://domain{i}.com/cluster-{j}",
                f"keyword {j}"
            ))

    c.executemany('''
        INSERT INTO projects (id, name, domain, geo, competitors, brand_name, sitemap_url, business_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', projects_data)

    c.executemany('''
        INSERT INTO clusters (project_id, name, url, target_kw)
        VALUES (?, ?, ?, ?)
    ''', clusters_data)

    conn.commit()

def run_benchmark():
    print(f"--- Benchmarking get_all_projects ---")
    print(f"Dataset: {NUM_PROJECTS} Projects, {NUM_PROJECTS * CLUSTERS_PER_PROJECT} Clusters")

    with patch_db_file() as db_path:
        # Seed Data
        conn = sqlite3.connect(db_path)
        seed_data(conn)
        conn.close()

        # Warmup (optional, but good for caching effects if any)
        apps.core.database.get_all_projects()

        # Benchmark
        iterations = 10
        start_time = time.time()

        for _ in range(iterations):
            projects = apps.core.database.get_all_projects()

        end_time = time.time()
        total_time = end_time - start_time
        avg_time = total_time / iterations

        print(f"Total time for {iterations} iterations: {total_time:.4f}s")
        print(f"Average time per call: {avg_time:.4f}s")

        # Verification check
        assert len(projects) == NUM_PROJECTS
        assert len(projects[0]['clusters']) == CLUSTERS_PER_PROJECT
        print("✅ Data verification passed")

if __name__ == "__main__":
    run_benchmark()

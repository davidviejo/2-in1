
import sqlite3
import time
import json
import os
import logging
import uuid
import sys
import importlib.util
from unittest.mock import MagicMock

# Setup logging
logging.basicConfig(level=logging.ERROR)

# Mock dependencies to avoid loading apps/__init__.py and missing deps
sys.modules['flask'] = MagicMock()
sys.modules['apps.trends_provider'] = MagicMock()
sys.modules['apps.core.database'] = MagicMock()
sys.modules['apps'] = MagicMock()

# Load backend/p2/apps/web/blueprints/trends_economy.py directly
module_name = "apps.trends_economy"
file_path = "backend/p2/apps/web/blueprints/trends_economy.py"

spec = importlib.util.spec_from_file_location(module_name, file_path)
trends_economy = importlib.util.module_from_spec(spec)
sys.modules[module_name] = trends_economy
spec.loader.exec_module(trends_economy)

# Monkeypatch DB_FILE after import (init_db already ran on import)
TEST_DB_FILE = 'benchmark_trends_jobs.db'
trends_economy.DB_FILE = TEST_DB_FILE

# Get functions
update_job_status = trends_economy.update_job_status
init_db = trends_economy.init_db

def run_benchmark():
    # Cleanup main DB if created by import
    if os.path.exists('trends_jobs.db'):
        try:
            os.remove('trends_jobs.db')
        except:
            pass

    # Ensure clean state for test DB
    if os.path.exists(TEST_DB_FILE):
        os.remove(TEST_DB_FILE)

    init_db()

    job_id = str(uuid.uuid4())

    # Create initial job
    conn = sqlite3.connect(TEST_DB_FILE)
    c = conn.cursor()
    c.execute("INSERT INTO jobs (job_id, active, progress, log, data, error, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
              (job_id, 1, 0, json.dumps(["Start"]), json.dumps([]), None, time.time()))
    conn.commit()
    conn.close()

    iterations = 1000
    print(f"Running benchmark with {iterations} iterations on ACTUAL code...")

    # Benchmark: Without connection reuse (simulates old behavior)
    start_time = time.time()
    for i in range(iterations):
        update_job_status(job_id, {'progress': i % 100, 'log_append': f"Update {i}"}, conn=None)
    end_time = time.time()
    original_duration = end_time - start_time
    print(f"Without connection reuse: {original_duration:.4f} seconds")

    # Reset DB for fair comparison
    if os.path.exists(TEST_DB_FILE):
        os.remove(TEST_DB_FILE)
    init_db()
    conn = sqlite3.connect(TEST_DB_FILE)
    c = conn.cursor()
    c.execute("INSERT INTO jobs (job_id, active, progress, log, data, error, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
              (job_id, 1, 0, json.dumps(["Start"]), json.dumps([]), None, time.time()))
    conn.commit()
    conn.close()

    # Benchmark: With connection reuse
    start_time = time.time()
    reused_conn = sqlite3.connect(TEST_DB_FILE)
    for i in range(iterations):
        update_job_status(job_id, {'progress': i % 100, 'log_append': f"Update {i}"}, conn=reused_conn)
    reused_conn.close()
    end_time = time.time()
    optimized_duration = end_time - start_time
    print(f"With connection reuse: {optimized_duration:.4f} seconds")

    improvement = (original_duration - optimized_duration) / original_duration * 100
    print(f"Improvement: {improvement:.2f}%")

    # Cleanup
    if os.path.exists(TEST_DB_FILE):
        os.remove(TEST_DB_FILE)

if __name__ == "__main__":
    run_benchmark()

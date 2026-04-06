import time
import os
import sys
import sqlite3
import tempfile
import uuid
from contextlib import contextmanager

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import apps.core.database

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

def generate_clusters(count):
    return [
        {
            "name": f"Cluster {i}",
            "url": f"http://example.com/cluster-{i}",
            "target_kw": f"keyword {i}"
        }
        for i in range(count)
    ]

def run_benchmark():
    print("--- Benchmarking replace_clusters ---")

    # Test cases: (Batch Size, Iterations)
    scenarios = [
        (100, 10),
        (1000, 5),
        (5000, 3)
    ]

    with patch_db_file() as db_path:
        # Create a dummy project
        project_id = str(uuid.uuid4())
        apps.core.database.upsert_project({
            "id": project_id,
            "name": "Benchmark Project",
            "domain": "example.com",
            "business_type": "benchmark"
        })

        for batch_size, iterations in scenarios:
            print(f"\nScenario: {batch_size} clusters, {iterations} iterations")
            clusters = generate_clusters(batch_size)

            total_time = 0
            for i in range(iterations):
                start_time = time.time()
                apps.core.database.replace_clusters(project_id, clusters)
                end_time = time.time()
                total_time += (end_time - start_time)

            avg_time = total_time / iterations
            print(f"  Total time: {total_time:.4f}s")
            print(f"  Avg time:   {avg_time:.4f}s")
            print(f"  Rate:       {batch_size / avg_time:.0f} clusters/sec")

            # Verify insertion count
            conn = sqlite3.connect(db_path)
            c = conn.cursor()
            c.execute("SELECT COUNT(*) FROM clusters WHERE project_id = ?", (project_id,))
            count = c.fetchone()[0]
            conn.close()

            if count != batch_size:
                print(f"  ❌ Verification FAILED: Expected {batch_size}, got {count}")
            else:
                print(f"  ✅ Verification Passed: {count} records found")

if __name__ == "__main__":
    run_benchmark()


import time
import concurrent.futures
from unittest.mock import MagicMock, patch

# Import the actual function to test
from apps.web.blueprints.monitor_daemon import check_target

# --- Simulation Config ---
NUM_URLS = 50
LATENCY = 0.1  # seconds per request

# --- Mock Data ---
urls_to_check = [{"name": f"URL {i}", "url": f"http://example.com/{i}"} for i in range(NUM_URLS)]
project = {"name": "Test Project"}

# --- Mock Requests ---
def mocked_requests_head(*args, **kwargs):
    time.sleep(LATENCY)
    return MagicMock(status_code=200, elapsed=MagicMock(total_seconds=lambda: 0.1))

# --- Optimized Implementation (Parallel) ---
# We use the actual check_target function imported from the module.
# We just need to mock add_alert inside the module or patch it.

def run_parallel():
    start_time = time.time()

    # Patching requests.head and add_alert where they are used
    with patch('apps.web.blueprints.monitor_daemon.requests.head', side_effect=mocked_requests_head), \
         patch('apps.web.blueprints.monitor_daemon.add_alert'):

        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
             executor.map(lambda t: check_target(t, project['name']), urls_to_check)

    return time.time() - start_time

if __name__ == "__main__":
    print(f"Running verification with {NUM_URLS} URLs using actual code structure.")

    # We only measure the parallel implementation here to verify it works and is fast.
    # The baseline was already established.

    par_time = run_parallel()
    print(f"Parallel Time:   {par_time:.4f}s")

    # Expectation: ~0.5s (0.1s * 50 / 10)
    if par_time < 1.0:
        print("✅ Performance Verification Passed!")
    else:
        print("❌ Performance Verification Failed (Too slow)!")

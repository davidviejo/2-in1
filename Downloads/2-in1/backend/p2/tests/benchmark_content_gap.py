import time
from unittest.mock import patch
from flask import Flask
from apps.web.blueprints.content_gap import gap_bp

# Setup app
app = Flask(__name__)
app.register_blueprint(gap_bp)
client = app.test_client()

# Mock response
class MockResponse:
    def __init__(self, content, status_code=200):
        self.content = content
        self.status_code = status_code

def mock_requests_get(url, **kwargs):
    time.sleep(0.2) # Simulate latency
    return MockResponse(b"<html><body><p>Test content for benchmarking.</p></body></html>")

def benchmark():
    # Patch where it is used
    with patch('apps.web.blueprints.content_gap.requests.get', side_effect=mock_requests_get):
        start_time = time.time()

        # 10 competitor URLs + 1 my_url = 11 requests
        payload = {
            'my_url': 'http://mysite.com',
            'comp_urls': [f'http://comp{i}.com' for i in range(10)]
        }

        print("Running benchmark with 11 sequential requests (simulated 0.2s latency each)...")
        resp = client.post('/gap/analyze', json=payload)
        end_time = time.time()

        print(f"Status Code: {resp.status_code}")
        if resp.status_code != 200:
             print(resp.json)

        duration = end_time - start_time
        print(f"Duration: {duration:.4f} seconds")
        return duration

if __name__ == "__main__":
    benchmark()

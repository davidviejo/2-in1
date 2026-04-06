import threading
import time
import sys
import os
from flask import Flask

# Ensure apps is in path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from apps.web.blueprints.crawler_tool import crawl_site
import logging

# Suppress Flask logging
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

app = Flask(__name__)

PAGES_COUNT = 50
LATENCY = 0.05

@app.route('/page/<int:page_id>')
def page(page_id):
    time.sleep(LATENCY)
    links = []
    # Link to next 5 pages
    for i in range(1, 6):
        target = (page_id + i) % PAGES_COUNT
        links.append(f'<a href="/page/{target}">Page {target}</a>')

    html = f"""
    <html>
    <body>
        <h1>Page {page_id}</h1>
        {'<br>'.join(links)}
    </body>
    </html>
    """
    return html

def run_server():
    try:
        app.run(port=5002, threaded=True, debug=False, use_reloader=False)
    except Exception as e:
        print(f"Server error: {e}")

def run_benchmark():
    # Start server
    server_thread = threading.Thread(target=run_server, daemon=True)
    server_thread.start()

    # Wait for server to start
    time.sleep(2)

    start_url = "http://127.0.0.1:5002/page/0"

    print(f"Starting benchmark with {PAGES_COUNT} pages and {LATENCY}s latency per page...")
    start_time = time.time()

    try:
        visited = crawl_site(start_url, max_pages=PAGES_COUNT)
    except Exception as e:
        print(f"Crawl failed: {e}")
        visited = []

    end_time = time.time()
    duration = end_time - start_time

    print(f"Crawled {len(visited)} pages in {duration:.2f} seconds.")

if __name__ == "__main__":
    run_benchmark()

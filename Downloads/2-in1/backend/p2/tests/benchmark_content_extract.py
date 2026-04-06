import time
import re
from bs4 import BeautifulSoup

# Current implementation logic
def extract_slow(soup):
    for x in soup(["script","style","nav","footer"]): x.extract()
    markdown_lines = []
    for tag in soup.find_all(['h1','h2','h3','p']):
        txt = re.sub(r'\s+', ' ', tag.get_text(strip=True))
        if len(txt)>10:
            pre = '#' if tag.name=='h1' else ('##' if tag.name=='h2' else '')
            markdown_lines.append(f"{pre} {txt}")
    return "\n".join(markdown_lines)

# Optimized implementation logic
WS_PATTERN = re.compile(r'\s+')

def extract_fast(soup):
    for x in soup(["script","style","nav","footer"]): x.extract()
    markdown_lines = []
    for tag in soup.find_all(['h1','h2','h3','p']):
        txt = WS_PATTERN.sub(' ', tag.get_text(strip=True))
        if len(txt)>10:
            pre = '#' if tag.name=='h1' else ('##' if tag.name=='h2' else '')
            markdown_lines.append(f"{pre} {txt}")
    return "\n".join(markdown_lines)

def run_benchmark():
    # Generate large HTML
    base_html = "<html><body>"
    # Create 5000 repeated blocks to simulate a large document
    for i in range(5000):
        base_html += "<h1>  Title  with   spaces  </h1>"
        base_html += "<p>  Some   paragraph text   that is   long enough to be   captured.  </p>"
        base_html += "<h2>  Subtitle   </h2>"
    base_html += "</body></html>"

    print("Starting benchmark...")

    # Need fresh soup for each run as extract() modifies it
    soup_slow = BeautifulSoup(base_html, 'html.parser')
    soup_fast = BeautifulSoup(base_html, 'html.parser')

    start_slow = time.time()
    res_slow = extract_slow(soup_slow)
    end_slow = time.time()
    time_slow = end_slow - start_slow
    print(f"Slow: {time_slow:.4f}s")

    start_fast = time.time()
    res_fast = extract_fast(soup_fast)
    end_fast = time.time()
    time_fast = end_fast - start_fast
    print(f"Fast: {time_fast:.4f}s")

    if res_slow != res_fast:
        print("ERROR: Outputs differ!")
    else:
        print("SUCCESS: Outputs match.")

    improvement = (time_slow - time_fast) / time_slow * 100
    print(f"Improvement: {improvement:.2f}%")

if __name__ == "__main__":
    run_benchmark()

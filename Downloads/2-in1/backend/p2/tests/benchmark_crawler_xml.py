
import time
import timeit
import sys

def generate_xml_concatenation(urls):
    xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    for u in urls:
        xml += f'  <url><loc>{u}</loc><lastmod>2023-10-27</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url>\n'
    xml += '</urlset>'
    return xml

def generate_xml_join(urls):
    parts = ['<?xml version="1.0" encoding="UTF-8"?>\n', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n']
    for u in urls:
        parts.append(f'  <url><loc>{u}</loc><lastmod>2023-10-27</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url>\n')
    parts.append('</urlset>')
    return ''.join(parts)

def run_benchmark():
    # Setup data
    num_urls = 200000
    # Make URLs longer
    urls = [f'http://example.com/page/{i}/some/long/path/to/simulate/realistic/url/structure/which/might/affect/memory/allocation' for i in range(num_urls)]

    print(f"Benchmarking with {num_urls} URLs...")

    # Test Concatenation
    start_time = time.time()
    res1 = generate_xml_concatenation(urls)
    end_time = time.time()
    concat_time = end_time - start_time
    print(f"Concatenation time: {concat_time:.4f} seconds")

    # Test Join
    start_time = time.time()
    res2 = generate_xml_join(urls)
    end_time = time.time()
    join_time = end_time - start_time
    print(f"Join time:          {join_time:.4f} seconds")

    # Verify correctness
    assert res1 == res2, "Results do not match!"

    if concat_time > 0:
        improvement = (concat_time - join_time) / concat_time * 100
        print(f"Improvement: {improvement:.2f}%")
    else:
        print("Concatenation time was 0, cannot calculate improvement.")

if __name__ == "__main__":
    run_benchmark()

"""
Module for web crawling and sitemap generation utilities.
Provides endpoints to crawl a site, extract URLs, and download sitemaps.
"""
from flask import Blueprint, render_template, request, jsonify, Response
import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse, urljoin
import concurrent.futures
from apps.tools.utils import is_safe_url

crawler_bp = Blueprint('crawler', __name__, url_prefix='/crawler')


def crawl_site(start_url, max_pages=100):
    """
    Crawls a website starting from a given URL using a BFS strategy with
    concurrent workers.

    Args:
        start_url (str): The URL to start crawling from.
        max_pages (int): The maximum number of pages to crawl. Defaults to 100.

    Returns:
        list: A list of unique URLs visited within the same domain.
    """
    visited = set()
    seen = {start_url}
    queue = [start_url]
    base_domain = urlparse(start_url).netloc

    def fetch_links(url):
        if not is_safe_url(url):
            return []
        try:
            r = requests.get(url, timeout=3)
            if r.status_code == 200:
                s = BeautifulSoup(r.content, 'html.parser')
                links = []
                for a in s.find_all('a', href=True):
                    full = urljoin(url, a['href']).split('#')[0]
                    if urlparse(full).netloc == base_domain:
                        links.append(full)
                return links
        except Exception:
            pass
        return []

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = {}

        while len(visited) < max_pages and (queue or futures):
            # Fill the workers
            while queue and len(futures) < 10 and \
                    (len(visited) + len(futures) < max_pages):
                url = queue.pop(0)
                future = executor.submit(fetch_links, url)
                futures[future] = url

            if not futures:
                break

            done, _ = concurrent.futures.wait(
                futures, return_when=concurrent.futures.FIRST_COMPLETED
            )

            for future in done:
                url = futures.pop(future)
                visited.add(url)

                try:
                    new_links = future.result()
                    for link in new_links:
                        if link not in seen:
                            seen.add(link)
                            queue.append(link)
                except Exception:
                    pass

    return list(visited)


@crawler_bp.route('/')
def index():
    """
    Renders the crawler dashboard page.
    """
    return render_template('crawler/dashboard.html')


@crawler_bp.route('/run', methods=['POST'])
def run():
    """
    Initiates the crawling process for a given URL.
    Accepts 'url' and 'limit' (max pages) in the JSON body.
    """
    req = request.get_json(silent=True) or {}
    u = req.get('url')
    if not u:
        return jsonify({'error': 'URL missing'}), 400
    limit = int(req.get('limit', 100))
    urls = crawl_site(u, limit)
    return jsonify({'status': 'ok', 'count': len(urls), 'urls': urls})


@crawler_bp.route('/download_xml', methods=['POST'])
def download_xml():
    """
    Generates and downloads a Sitemap XML file from a list of URLs.
    """
    urls = (request.get_json(silent=True) or {}).get('urls', [])
    xml_parts = ['<?xml version="1.0" encoding="UTF-8"?>\n', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n']
    for u in urls:
        xml_parts.append(f'  <url><loc>{u}</loc></url>\n')
    xml_parts.append('</urlset>')
    return Response(
        ''.join(xml_parts),
        mimetype='application/xml',
        headers={"Content-disposition": "attachment; filename=sitemap.xml"}
    )

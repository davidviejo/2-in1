"""Módulo para el análisis de textos de anclaje (anchor texts)."""
from flask import Blueprint, render_template, request, jsonify, send_file
import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse, urljoin
import concurrent.futures
import pandas as pd
import io
from collections import Counter, deque

anchor_bp = Blueprint('anchor', __name__, url_prefix='/anchor')

USER_AGENT = {'User-Agent': 'Mozilla/5.0'}
MAX_CRAWL_URLS = 200


def _normalize_url(url):
    return url.split('#')[0].strip()


def _resolve_link_location(anchor_tag):
    for parent in anchor_tag.parents:
        tag_name = (getattr(parent, 'name', '') or '').lower()
        if tag_name == 'header':
            return 'header'
        if tag_name == 'footer':
            return 'footer'
        if tag_name in {'main', 'article', 'section'}:
            return 'content'

        classes = ' '.join(parent.get('class', [])).lower() if hasattr(parent, 'get') else ''
        identifier = (parent.get('id', '') or '').lower() if hasattr(parent, 'get') else ''
        hint = f"{classes} {identifier}"
        if any(token in hint for token in ['header', 'menu', 'nav', 'masthead']):
            return 'header'
        if any(token in hint for token in ['footer', 'legal', 'copyright']):
            return 'footer'
    return 'content'


def scan(url, dom):
    links = []
    discovered_internal_urls = set()
    try:
        response = requests.get(url, timeout=10, headers=USER_AGENT)
        soup = BeautifulSoup(response.content, 'html.parser')
        for anchor in soup.find_all('a', href=True):
            full = _normalize_url(urljoin(url, anchor['href']))
            text = anchor.get_text(' ', strip=True)
            if not full or dom != urlparse(full).netloc:
                continue
            discovered_internal_urls.add(full)
            if not text:
                continue
            links.append({
                'source_url': url,
                'target_url': full,
                'anchor': text,
                'location': _resolve_link_location(anchor),
            })
    except Exception:
        pass
    return links, discovered_internal_urls


def _collect_urls_to_scan(seed_urls, mode):
    normalized = [_normalize_url(u) for u in seed_urls if u and u.strip()]
    if not normalized:
        return [], '', []

    seed = normalized[0]
    dom = urlparse(seed).netloc
    if not dom:
        return [], '', []

    if mode == 'single_only':
        return [seed], dom, [seed]

    if mode == 'single_plus_links':
        _, discovered = scan(seed, dom)
        queue = [seed, *sorted(discovered)]
        queue = list(dict.fromkeys(queue))[:MAX_CRAWL_URLS]
        return queue, dom, [seed]

    # recursive
    visited = set()
    pending = deque([seed])
    ordered = []
    while pending and len(visited) < MAX_CRAWL_URLS:
        current = pending.popleft()
        if current in visited:
            continue
        visited.add(current)
        ordered.append(current)
        _, discovered = scan(current, dom)
        for nxt in sorted(discovered):
            if nxt not in visited and nxt not in pending and len(visited) + len(pending) < MAX_CRAWL_URLS:
                pending.append(nxt)

    return ordered, dom, [seed]


@anchor_bp.route('/')
def index():
    return render_template('anchor/dashboard.html')


@anchor_bp.route('/analyze', methods=['POST'])
def analyze():
    payload = request.json or {}
    urls = payload.get('urls', [])
    mode = payload.get('scan_mode', 'single_only')
    allowed_modes = {'single_only', 'single_plus_links', 'recursive'}
    if mode not in allowed_modes:
        mode = 'single_only'

    urls_to_scan, dom, seeds = _collect_urls_to_scan(urls, mode)
    if not urls_to_scan:
        return jsonify({'status': 'error', 'message': 'No se detectó una URL válida para escanear.'}), 400

    all_links = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
        futures = {ex.submit(scan, url, dom): url for url in urls_to_scan}
        for future in concurrent.futures.as_completed(futures):
            links, _ = future.result()
            all_links.extend(links)

    by_target = {}
    for link in all_links:
        target = link['target_url']
        by_target.setdefault(target, []).append(link['anchor'])

    summary = []
    for target, anchors in by_target.items():
        common = Counter(anchors).most_common(5)
        summary.append({'url': target, 'total': len(anchors), 'top': ", ".join([f"{text}({count})" for text, count in common])})

    return jsonify({
        'status': 'ok',
        'scan_mode': mode,
        'seed_urls': seeds,
        'scanned_urls_count': len(urls_to_scan),
        'scanned_urls': urls_to_scan,
        'summary': sorted(summary, key=lambda item: item['total'], reverse=True)[:200],
        'details': all_links,
    })


@anchor_bp.route('/download', methods=['POST'])
def download():
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        pd.DataFrame(request.json.get('data')).to_excel(writer, index=False)
    output.seek(0)
    return send_file(output, download_name='anchors.xlsx', as_attachment=True)

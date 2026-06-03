from __future__ import annotations

import csv
import io
import re
import threading
import time
import uuid
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from typing import Any
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

from apps.tools.utils import is_safe_url, normalize, validate_url

MAX_WORKERS_DEFAULT = 8
MAX_WORKERS_LIMIT = 20
REQUEST_TIMEOUT = (4, 10)
DEFAULT_MAX_URLS = 500
DEFAULT_MAX_PATTERNS = 250
USER_AGENT = 'Mozilla/5.0 (compatible; 2-in-1-url-finder/1.0; +https://agenciaseo.eu)'

# In production, replace this in-memory store with Redis, Celery/RQ or a database-backed queue.
JOBS: dict[str, dict[str, Any]] = {}
JOBS_LOCK = threading.Lock()
_THREAD_LOCAL = threading.local()


@dataclass(frozen=True)
class UrlFinderInput:
    urls: list[str]
    words: list[str]
    domains: list[str]
    max_workers: int = MAX_WORKERS_DEFAULT


def parse_list(raw_value: Any, *, max_items: int | None = None) -> list[str]:
    """Accept newline, comma or semicolon separated values and preserve original order."""
    if raw_value is None:
        raw_items: list[Any] = []
    elif isinstance(raw_value, str):
        raw_items = re.split(r'[\n,;]+', raw_value)
    elif isinstance(raw_value, list):
        raw_items = raw_value
    else:
        raw_items = [raw_value]

    seen: set[str] = set()
    parsed_items: list[str] = []
    for item in raw_items:
        text = str(item).strip()
        if not text or text in seen:
            continue
        parsed_items.append(text)
        seen.add(text)
        if max_items is not None and len(parsed_items) >= max_items:
            break
    return parsed_items


# Backward-compatible alias used by the previous implementation/tests.
def parse_lines(value: Any, *, max_items: int) -> list[str]:
    return parse_list(value, max_items=max_items)


def normalize_url(url: str) -> str:
    """Trim an URL and add https:// when the user omitted a scheme."""
    candidate = (url or '').strip()
    if not candidate:
        return ''
    parsed = urlparse(candidate)
    if not parsed.scheme:
        return f'https://{candidate}'
    return candidate


def normalize_domain(domain: str) -> str:
    """Remove protocol, path, port and leading www. from a domain or URL."""
    candidate = (domain or '').strip().lower()
    if not candidate:
        return ''
    parsed = urlparse(candidate if '://' in candidate else f'https://{candidate}')
    host = parsed.netloc or parsed.path
    host = host.split('@')[-1].split(':')[0].strip().strip('.')
    return host[4:] if host.startswith('www.') else host


def normalize_max_workers(raw_value: Any) -> int:
    try:
        requested = int(raw_value)
    except (TypeError, ValueError):
        requested = MAX_WORKERS_DEFAULT
    return max(1, min(requested, MAX_WORKERS_LIMIT))


def parse_payload(payload: dict[str, Any]) -> UrlFinderInput:
    return UrlFinderInput(
        urls=[normalize_url(item) for item in parse_list(payload.get('urls'), max_items=DEFAULT_MAX_URLS)],
        words=parse_list(payload.get('words') or payload.get('terms') or payload.get('keywords'), max_items=DEFAULT_MAX_PATTERNS),
        domains=[normalize_domain(item) for item in parse_list(payload.get('domains'), max_items=DEFAULT_MAX_PATTERNS)],
        max_workers=normalize_max_workers(payload.get('max_workers', MAX_WORKERS_DEFAULT)),
    )


def get_thread_session() -> requests.Session:
    session = getattr(_THREAD_LOCAL, 'session', None)
    if session is None:
        session = requests.Session()
        session.headers.update({'User-Agent': USER_AGENT})
        _THREAD_LOCAL.session = session
    return session


def fetch_url(url: str) -> requests.Response:
    """Fetch a safe URL with a per-thread HTTP session."""
    if not validate_url(url):
        raise ValueError('URL inválida. Usa http:// o https://.')
    if not is_safe_url(url):
        raise ValueError('URL no permitida por validación SSRF.')
    response = get_thread_session().get(url, timeout=REQUEST_TIMEOUT, allow_redirects=True)
    response.raise_for_status()
    return response


def extract_visible_text(html: str | BeautifulSoup) -> str:
    soup = html if isinstance(html, BeautifulSoup) else BeautifulSoup(html or '', 'html.parser')
    for node in soup(['script', 'style', 'noscript', 'svg', 'template']):
        node.decompose()
    return soup.get_text(' ', strip=True)


def count_term_occurrences(text: str, term: str) -> int:
    normalized_text = normalize(text)
    normalized_term = normalize(term)
    if not normalized_term:
        return 0
    return len(re.findall(re.escape(normalized_term), normalized_text))


def count_terms(text: str, terms: list[str]) -> dict[str, int]:
    return {term: count_term_occurrences(text, term) for term in terms}


def extract_links(html: str, base_url: str) -> list[dict[str, str]]:
    soup = BeautifulSoup(html or '', 'html.parser')
    links: list[dict[str, str]] = []
    for anchor in soup.find_all('a', href=True):
        raw_href = str(anchor.get('href', '')).strip()
        absolute_url = urljoin(base_url, raw_href).split('#')[0]
        parsed = urlparse(absolute_url)
        if parsed.scheme not in {'http', 'https'} or not parsed.netloc:
            continue
        link_domain = normalize_domain(parsed.netloc)
        if not link_domain:
            continue
        links.append(
            {
                'href': absolute_url,
                'domain': link_domain,
                'anchor': anchor.get_text(' ', strip=True),
                'rel': ' '.join(anchor.get('rel', [])) if isinstance(anchor.get('rel'), list) else str(anchor.get('rel') or ''),
            }
        )
    return links


def domain_matches(found_domain: str, target_domain: str) -> bool:
    found = normalize_domain(found_domain)
    target = normalize_domain(target_domain)
    if not found or not target:
        return False
    return found == target or found.endswith(f'.{target}')


def analyze_html(url: str, html: str, words: list[str], domains: list[str]) -> dict[str, Any]:
    visible_text = extract_visible_text(html)
    word_counts = count_terms(visible_text, words)
    links = extract_links(html, url)
    target_domains = [normalize_domain(domain) for domain in domains if normalize_domain(domain)]
    unique_link_domains = sorted({link['domain'] for link in links})
    domain_counts: Counter[str] = Counter()
    matched_links: list[dict[str, str]] = []

    for link in links:
        matching_domains = [domain for domain in target_domains if domain_matches(link['domain'], domain)]
        if not target_domains:
            matching_domains = [link['domain']]
        for target_domain in matching_domains:
            domain_counts[target_domain] += 1
            matched_links.append(
                {
                    'target_domain': target_domain,
                    'found_domain': link['domain'],
                    'link_domain': link['domain'],
                    'href': link['href'],
                    'anchor': link['anchor'],
                    'rel': link['rel'],
                }
            )

    return {
        'word_counts': word_counts,
        'term_counts': word_counts,
        'domain_counts': dict(domain_counts),
        'matched_links': matched_links,
        'total_links': len(links),
        'unique_link_domains_count': len(unique_link_domains),
        'unique_link_domains': unique_link_domains,
        'total_word_matches': sum(word_counts.values()),
        'total_term_matches': sum(word_counts.values()),
        'total_domain_link_matches': sum(domain_counts.values()),
        'word_count': len(re.findall(r'\w+', normalize(visible_text))),
    }


def analyze_single_url(input_url: str, words: list[str], domains: list[str], input_index: int = 0) -> dict[str, Any]:
    normalized_input_url = normalize_url(input_url)
    base_result: dict[str, Any] = {
        'input_index': input_index,
        'input_url': input_url,
        'url': normalized_input_url,
        'final_url': '',
        'status_code': None,
        'content_type': '',
        'word_counts': {},
        'term_counts': {},
        'domain_counts': {},
        'matched_links': [],
        'total_links': 0,
        'unique_link_domains_count': 0,
        'unique_link_domains': [],
        'error': None,
        'status': 'error',
    }

    try:
        response = fetch_url(normalized_input_url)
        content_type = response.headers.get('content-type', '')
        base_result.update(
            {
                'final_url': response.url,
                'status_code': response.status_code,
                'content_type': content_type,
            }
        )
        if 'html' not in content_type.lower() and not response.text.lstrip().startswith('<'):
            base_result['error'] = 'La respuesta no parece HTML.'
            return base_result

        analysis = analyze_html(response.url or normalized_input_url, response.text, words, domains)
        base_result.update(analysis)
        base_result['status'] = 'ok'
        return base_result
    except (requests.RequestException, ValueError) as exc:
        base_result['error'] = str(exc)
        return base_result


# Backward-compatible wrapper used by older tests/callers.
def fetch_and_analyze_url(url: str, terms: list[str], domains: list[str], *, timeout: Any = REQUEST_TIMEOUT) -> dict[str, Any]:
    del timeout
    return analyze_single_url(url, terms, domains)


def summarize_results(results: list[dict[str, Any]]) -> dict[str, Any]:
    words_summary: Counter[str] = Counter()
    domains_summary: Counter[str] = Counter()
    for result in results:
        if result.get('status') != 'ok':
            continue
        words_summary.update(result.get('word_counts', {}))
        domains_summary.update(result.get('domain_counts', {}))

    return {
        'urls_total': len(results),
        'urls_ok': sum(1 for result in results if result.get('status') == 'ok'),
        'urls_error': sum(1 for result in results if result.get('status') != 'ok'),
        'words': dict(words_summary),
        'terms': dict(words_summary),
        'domains': dict(domains_summary),
        'total_word_matches': sum(words_summary.values()),
        'total_term_matches': sum(words_summary.values()),
        'total_domain_link_matches': sum(domains_summary.values()),
    }


def analyze_urls(urls: list[str], words: list[str], domains: list[str], max_workers: int = MAX_WORKERS_DEFAULT) -> dict[str, Any]:
    workers = normalize_max_workers(max_workers)
    ordered_results: list[dict[str, Any] | None] = [None] * len(urls)
    with ThreadPoolExecutor(max_workers=workers) as executor:
        future_to_index = {
            executor.submit(analyze_single_url, input_url, words, domains, index): index
            for index, input_url in enumerate(urls)
        }
        for future in as_completed(future_to_index):
            index = future_to_index[future]
            try:
                ordered_results[index] = future.result()
            except (RuntimeError, ValueError, requests.RequestException) as exc:  # Defensive: never let one URL stop the full analysis.
                ordered_results[index] = {
                    'input_index': index,
                    'input_url': urls[index],
                    'url': normalize_url(urls[index]),
                    'final_url': '',
                    'status_code': None,
                    'content_type': '',
                    'word_counts': {},
                    'term_counts': {},
                    'domain_counts': {},
                    'matched_links': [],
                    'total_links': 0,
                    'unique_link_domains_count': 0,
                    'unique_link_domains': [],
                    'error': str(exc),
                    'status': 'error',
                }

    results = [result for result in ordered_results if result is not None]
    return {'ok': True, 'status': 'ok', 'summary': summarize_results(results), 'results': results}


def create_job(urls: list[str], words: list[str], domains: list[str], max_workers: int = MAX_WORKERS_DEFAULT) -> str:
    job_id = str(uuid.uuid4())
    workers = normalize_max_workers(max_workers)
    now = time.monotonic()
    job = {
        'id': job_id,
        'status': 'queued',
        'total': len(urls),
        'completed': 0,
        'progress_percent': 0,
        'current_url': '',
        'eta_seconds': None,
        'results': [None] * len(urls),
        'error': None,
        'created_at': now,
        'started_at': None,
        'completed_at': None,
        'max_workers': workers,
    }
    with JOBS_LOCK:
        JOBS[job_id] = job

    thread = threading.Thread(target=run_job, args=(job_id, urls, words, domains, workers), daemon=True)
    thread.start()
    return job_id


def run_job(job_id: str, urls: list[str], words: list[str], domains: list[str], max_workers: int) -> None:
    update_job(job_id, status='running', started_at=time.monotonic())
    if not urls:
        update_job(job_id, status='completed', completed_at=time.monotonic(), progress_percent=100, results=[])
        return

    try:
        with ThreadPoolExecutor(max_workers=normalize_max_workers(max_workers)) as executor:
            future_to_index = {
                executor.submit(analyze_single_url, input_url, words, domains, index): index
                for index, input_url in enumerate(urls)
            }
            for future in as_completed(future_to_index):
                index = future_to_index[future]
                try:
                    result = future.result()
                except (RuntimeError, ValueError, requests.RequestException) as exc:  # Defensive: failed URL should not fail the full job.
                    result = analyze_error_result(urls[index], index, str(exc))
                update_job_result(job_id, index, result)
        update_job(job_id, status='completed', completed_at=time.monotonic(), progress_percent=100, current_url='')
    except (RuntimeError, ValueError, requests.RequestException) as exc:
        update_job(job_id, status='failed', error=str(exc), completed_at=time.monotonic())


def analyze_error_result(input_url: str, input_index: int, error: str) -> dict[str, Any]:
    return {
        'input_index': input_index,
        'input_url': input_url,
        'url': normalize_url(input_url),
        'final_url': '',
        'status_code': None,
        'content_type': '',
        'word_counts': {},
        'term_counts': {},
        'domain_counts': {},
        'matched_links': [],
        'total_links': 0,
        'unique_link_domains_count': 0,
        'unique_link_domains': [],
        'error': error,
        'status': 'error',
    }


def update_job(job_id: str, **changes: Any) -> None:
    with JOBS_LOCK:
        job = JOBS.get(job_id)
        if not job:
            return
        job.update(changes)


def update_job_result(job_id: str, input_index: int, result: dict[str, Any]) -> None:
    with JOBS_LOCK:
        job = JOBS.get(job_id)
        if not job:
            return
        results = job['results']
        results[input_index] = result
        job['completed'] = sum(1 for item in results if item is not None)
        job['current_url'] = result.get('input_url') or result.get('url') or ''
        job['progress_percent'] = round((job['completed'] / max(job['total'], 1)) * 100, 2)
        job['eta_seconds'] = calculate_eta_seconds(job)


def calculate_eta_seconds(job: dict[str, Any]) -> int | None:
    started_at = job.get('started_at')
    completed = int(job.get('completed') or 0)
    total = int(job.get('total') or 0)
    if not started_at or completed <= 0 or completed >= total:
        return 0 if completed >= total else None
    elapsed = max(time.monotonic() - float(started_at), 0)
    seconds_per_url = elapsed / completed
    return max(0, round(seconds_per_url * (total - completed)))


def get_job_snapshot(job_id: str) -> dict[str, Any] | None:
    with JOBS_LOCK:
        job = JOBS.get(job_id)
        if not job:
            return None
        results = [result for result in job.get('results', []) if result is not None]
        return {
            'ok': True,
            'id': job['id'],
            'status': job['status'],
            'total': job['total'],
            'completed': job['completed'],
            'progress_percent': job['progress_percent'],
            'current_url': job['current_url'],
            'eta_seconds': job['eta_seconds'],
            'results': sorted(results, key=lambda item: item.get('input_index', 0)),
            'summary': summarize_results(sorted(results, key=lambda item: item.get('input_index', 0))),
            'error': job.get('error'),
            'max_workers': job.get('max_workers'),
        }


def build_csv(results: list[dict[str, Any]]) -> io.BytesIO:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        'input_index',
        'input_url',
        'final_url',
        'status_code',
        'content_type',
        'word',
        'word_count',
        'domain',
        'domain_link_count',
        'total_links',
        'unique_link_domains_count',
        'error',
    ])
    for result in results:
        word_counts = result.get('word_counts') or result.get('term_counts') or {'': ''}
        domain_counts = result.get('domain_counts') or {'': ''}
        for word, word_count in word_counts.items():
            for domain, domain_count in domain_counts.items():
                writer.writerow([
                    result.get('input_index', ''),
                    result.get('input_url') or result.get('url', ''),
                    result.get('final_url', ''),
                    result.get('status_code', ''),
                    result.get('content_type', ''),
                    word,
                    word_count,
                    domain,
                    domain_count,
                    result.get('total_links', ''),
                    result.get('unique_link_domains_count', ''),
                    result.get('error', ''),
                ])
    binary = io.BytesIO(output.getvalue().encode('utf-8-sig'))
    binary.seek(0)
    return binary

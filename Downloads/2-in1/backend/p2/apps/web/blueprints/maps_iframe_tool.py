from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import requests
from bs4 import BeautifulSoup
from flask import Blueprint, jsonify, render_template, request

from apps.tools.utils import clean_url, is_safe_url, validate_url

maps_iframe_bp = Blueprint('maps_iframe', __name__, url_prefix='/maps_iframe')


@dataclass(frozen=True)
class MapsIframeResult:
    url: str
    has_maps_iframe: bool
    iframe_code: str | None = None
    status_code: int | None = None
    error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            'url': self.url,
            'has_maps_iframe': self.has_maps_iframe,
            'iframe_code': self.iframe_code,
            'status_code': self.status_code,
            'error': self.error,
        }


def parse_urls(raw_value: Any) -> list[str]:
    """Parse textarea/list payloads into a de-duplicated URL list."""
    if isinstance(raw_value, list):
        candidates = raw_value
    else:
        candidates = str(raw_value or '').replace(',', '\n').splitlines()

    urls: list[str] = []
    seen: set[str] = set()
    for candidate in candidates:
        url = clean_url(str(candidate))
        if not url or url in seen:
            continue
        seen.add(url)
        urls.append(url)
    return urls


def is_google_maps_iframe_src(src: str | None) -> bool:
    if not src:
        return False
    normalized_src = src.strip().lower()
    return (
        'google.com/maps/embed' in normalized_src
        or 'maps.google.com/maps' in normalized_src
        or 'www.google.com/maps/embed' in normalized_src
    )


def extract_google_maps_iframe(html: str) -> str | None:
    soup = BeautifulSoup(html or '', 'html.parser')
    for iframe in soup.find_all('iframe'):
        if is_google_maps_iframe_src(iframe.get('src')):
            return str(iframe)
    return None


def analyze_url_for_maps_iframe(url: str) -> MapsIframeResult:
    normalized_url = clean_url(url)
    if not validate_url(normalized_url):
        return MapsIframeResult(url=normalized_url, has_maps_iframe=False, error='URL inválida. Usa http:// o https://.')
    if not is_safe_url(normalized_url):
        return MapsIframeResult(url=normalized_url, has_maps_iframe=False, error='URL no permitida por seguridad.')

    try:
        response = requests.get(
            normalized_url,
            headers={'User-Agent': 'Mozilla/5.0 (compatible; MapsIframeChecker/1.0)'},
            timeout=10,
        )
    except requests.RequestException as exc:
        return MapsIframeResult(url=normalized_url, has_maps_iframe=False, error=f'Error al descargar la URL: {exc}')

    iframe_code = extract_google_maps_iframe(response.text)
    return MapsIframeResult(
        url=normalized_url,
        has_maps_iframe=iframe_code is not None,
        iframe_code=iframe_code,
        status_code=response.status_code,
    )


@maps_iframe_bp.route('/')
def index():
    return render_template('maps_iframe/dashboard.html')


@maps_iframe_bp.route('/analyze', methods=['POST'])
def analyze():
    payload = request.get_json(silent=True) or {}
    urls = parse_urls(payload.get('urls') or payload.get('url'))
    if not urls:
        return jsonify({'status': 'error', 'error': 'Añade al menos una URL.'}), 400

    results = [analyze_url_for_maps_iframe(url).to_dict() for url in urls]
    return jsonify(
        {
            'status': 'ok',
            'summary': {
                'total': len(results),
                'with_maps_iframe': sum(1 for item in results if item['has_maps_iframe']),
                'without_maps_iframe': sum(1 for item in results if not item['has_maps_iframe']),
            },
            'results': results,
        }
    )

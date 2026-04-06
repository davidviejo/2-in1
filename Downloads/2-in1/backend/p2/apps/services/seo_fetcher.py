from __future__ import annotations

from dataclasses import dataclass

import requests
from requests import Response
from requests.exceptions import RequestException, SSLError, Timeout

DEFAULT_TIMEOUT_SECONDS = 12
DEFAULT_USER_AGENT = (
    'Mozilla/5.0 (compatible; PanelSEO/1.0; +https://panel.local/bot)'
)


@dataclass(slots=True)
class FetchResult:
    ok: bool
    status_code: int | None = None
    content: str = ''
    final_url: str = ''
    error: str = ''


class SeoFetchError(RuntimeError):
    """Error controlado para fallos de obtención HTTP."""


def fetch_html(
    url: str,
    *,
    timeout_seconds: int | float = DEFAULT_TIMEOUT_SECONDS,
    user_agent: str = DEFAULT_USER_AGENT,
    verify_ssl: bool = True,
) -> FetchResult:
    headers = {'User-Agent': user_agent}

    try:
        response: Response = requests.get(
            url,
            headers=headers,
            timeout=timeout_seconds,
            allow_redirects=True,
            verify=verify_ssl,
        )
    except Timeout as exc:
        return FetchResult(ok=False, error=f'Timeout al obtener URL: {exc}')
    except SSLError as exc:
        return FetchResult(ok=False, error=f'Error SSL al obtener URL: {exc}')
    except RequestException as exc:
        return FetchResult(ok=False, error=f'Error de red al obtener URL: {exc}')

    if response.status_code != 200:
        return FetchResult(
            ok=False,
            status_code=response.status_code,
            final_url=str(response.url),
            error=f'Código HTTP no exitoso: {response.status_code}',
        )

    return FetchResult(
        ok=True,
        status_code=response.status_code,
        content=response.text,
        final_url=str(response.url),
    )


__all__ = [
    'DEFAULT_TIMEOUT_SECONDS',
    'DEFAULT_USER_AGENT',
    'FetchResult',
    'SeoFetchError',
    'fetch_html',
]

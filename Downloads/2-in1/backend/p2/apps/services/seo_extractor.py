from __future__ import annotations

from dataclasses import dataclass

from bs4 import BeautifulSoup

_EXCLUDED_SELECTORS = ('script', 'style', 'nav', 'footer', 'form', 'iframe')


@dataclass(slots=True)
class ExtractedSeoContent:
    title: str
    meta_description: str
    h1: list[str]
    h2: list[str]
    h3: list[str]
    main_body: str


def _clean_text(value: str | None) -> str:
    if not value:
        return ''
    return ' '.join(value.split())


def extract_seo_content(html: str) -> ExtractedSeoContent:
    soup = BeautifulSoup(html or '', 'lxml')

    title_text = _clean_text(soup.title.get_text(strip=True) if soup.title else '')

    meta_tag = soup.find('meta', attrs={'name': lambda x: x and x.lower() == 'description'})
    meta_description = _clean_text(meta_tag.get('content', '') if meta_tag else '')

    h1 = [_clean_text(tag.get_text(' ', strip=True)) for tag in soup.find_all('h1')]
    h2 = [_clean_text(tag.get_text(' ', strip=True)) for tag in soup.find_all('h2')]
    h3 = [_clean_text(tag.get_text(' ', strip=True)) for tag in soup.find_all('h3')]

    body_soup = BeautifulSoup(str(soup.body or soup), 'lxml')
    for selector in _EXCLUDED_SELECTORS:
        for node in body_soup.find_all(selector):
            node.decompose()

    main_body = _clean_text(body_soup.get_text(' ', strip=True))

    return ExtractedSeoContent(
        title=title_text,
        meta_description=meta_description,
        h1=[value for value in h1 if value],
        h2=[value for value in h2 if value],
        h3=[value for value in h3 if value],
        main_body=main_body,
    )


__all__ = ['ExtractedSeoContent', 'extract_seo_content']

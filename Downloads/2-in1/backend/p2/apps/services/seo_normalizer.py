from __future__ import annotations

import re
import unicodedata

DEFAULT_SPANISH_STOPWORDS = {
    'a', 'al', 'algo', 'como', 'con', 'de', 'del', 'el', 'ella', 'en', 'entre', 'era', 'es', 'esa', 'ese',
    'esto', 'ha', 'hay', 'la', 'las', 'lo', 'los', 'más', 'mi', 'mis', 'muy', 'o', 'para', 'pero', 'por',
    'que', 'se', 'sin', 'sobre', 'su', 'sus', 'te', 'tu', 'tus', 'un', 'una', 'uno', 'unos', 'y',
}

_NON_ALNUM_RE = re.compile(r'[^\w\sáéíóúüñ]')
_MULTI_SPACE_RE = re.compile(r'\s+')


def _strip_diacritics(text: str) -> str:
    normalized = unicodedata.normalize('NFKD', text)
    return ''.join(char for char in normalized if not unicodedata.combining(char))


def normalize_text_es(
    text: str,
    *,
    remove_stopwords: bool = False,
    stopwords: set[str] | None = None,
    remove_diacritics: bool = False,
) -> str:
    cleaned = (text or '').lower().strip()
    cleaned = _NON_ALNUM_RE.sub(' ', cleaned)
    cleaned = _MULTI_SPACE_RE.sub(' ', cleaned).strip()

    if remove_diacritics:
        cleaned = _strip_diacritics(cleaned)

    if not remove_stopwords:
        return cleaned

    stopword_set = stopwords if stopwords is not None else DEFAULT_SPANISH_STOPWORDS
    tokens = [token for token in cleaned.split() if token not in stopword_set]
    return ' '.join(tokens)


def build_ngrams(text: str, *, ngram_range: tuple[int, int] = (1, 2)) -> list[str]:
    min_n, max_n = ngram_range
    if min_n < 1 or min_n > max_n:
        raise ValueError('ngram_range inválido')

    tokens = [token for token in (text or '').split() if token]
    ngrams: list[str] = []

    for size in range(min_n, max_n + 1):
        if size == 1:
            ngrams.extend(tokens)
            continue

        for idx in range(0, max(len(tokens) - size + 1, 0)):
            ngrams.append(' '.join(tokens[idx : idx + size]))

    return ngrams


__all__ = ['DEFAULT_SPANISH_STOPWORDS', 'normalize_text_es', 'build_ngrams']

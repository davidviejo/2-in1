from __future__ import annotations

from dataclasses import dataclass

from sklearn.feature_extraction.text import TfidfVectorizer


@dataclass(slots=True)
class TfIdfServiceConfig:
    strip_accents: str = 'unicode'
    lowercase: bool = True
    ngram_range: tuple[int, int] = (1, 2)
    sublinear_tf: bool = True
    norm: str = 'l2'
    min_df: int | float = 1
    max_df: int | float = 1.0
    max_features: int | None = None
    title_weight: int = 3
    h1_weight: int = 2


def build_weighted_document(
    *,
    title: str,
    h1: list[str],
    body: str,
    title_weight: int = 3,
    h1_weight: int = 2,
) -> str:
    title_block = ' '.join([title] * max(title_weight, 1)).strip()
    h1_block = ' '.join([' '.join(h1)] * max(h1_weight, 1)).strip()
    return ' '.join(part for part in [title_block, h1_block, body] if part).strip()


def create_vectorizer(config: TfIdfServiceConfig | None = None) -> TfidfVectorizer:
    cfg = config or TfIdfServiceConfig()
    return TfidfVectorizer(
        strip_accents=cfg.strip_accents,
        lowercase=cfg.lowercase,
        ngram_range=cfg.ngram_range,
        sublinear_tf=cfg.sublinear_tf,
        norm=cfg.norm,
        min_df=cfg.min_df,
        max_df=cfg.max_df,
        max_features=cfg.max_features,
    )


def fit_tfidf(corpus: list[str], config: TfIdfServiceConfig | None = None):
    vectorizer = create_vectorizer(config)
    matrix = vectorizer.fit_transform(corpus)
    return vectorizer, matrix


def get_document_term_scores(vectorizer: TfidfVectorizer, matrix, doc_index: int = 0) -> dict[str, float]:
    features = vectorizer.get_feature_names_out()
    row = matrix[doc_index]
    scores = {features[idx]: float(value) for idx, value in zip(row.indices, row.data, strict=False)}
    return dict(sorted(scores.items(), key=lambda item: item[1], reverse=True))


__all__ = [
    'TfIdfServiceConfig',
    'build_weighted_document',
    'create_vectorizer',
    'fit_tfidf',
    'get_document_term_scores',
]

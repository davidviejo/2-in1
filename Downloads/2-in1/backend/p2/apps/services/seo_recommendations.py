from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True)
class TermRecommendation:
    term: str
    target_score: float
    corpus_mean: float
    gap_score: float
    category: str


def classify_term(
    *,
    target_score: float,
    corpus_mean: float,
    threshold: float,
    weak_ratio: float = 0.45,
    overused_ratio: float = 1.8,
) -> str:
    if target_score == 0 and corpus_mean > threshold:
        return 'missing'
    if target_score < (corpus_mean * weak_ratio):
        return 'weak'
    if target_score > (corpus_mean * overused_ratio):
        return 'overused'
    return 'ok'


def build_term_recommendations(
    target_scores: dict[str, float],
    corpus_means: dict[str, float],
    *,
    threshold: float = 0.02,
) -> list[TermRecommendation]:
    all_terms = set(corpus_means) | set(target_scores)
    recommendations: list[TermRecommendation] = []

    for term in all_terms:
        target_score = float(target_scores.get(term, 0.0))
        corpus_mean = float(corpus_means.get(term, 0.0))
        gap_score = round(corpus_mean - target_score, 6)
        category = classify_term(
            target_score=target_score,
            corpus_mean=corpus_mean,
            threshold=threshold,
        )
        recommendations.append(
            TermRecommendation(
                term=term,
                target_score=round(target_score, 6),
                corpus_mean=round(corpus_mean, 6),
                gap_score=gap_score,
                category=category,
            )
        )

    return sorted(recommendations, key=lambda item: abs(item.gap_score), reverse=True)


def build_section_gaps(recommendations: list[TermRecommendation], *, top_n: int = 10) -> dict[str, list[str]]:
    missing_or_weak = [item.term for item in recommendations if item.category in {'missing', 'weak'}][:top_n]
    overused = [item.term for item in recommendations if item.category == 'overused'][:top_n]

    return {
        'title': missing_or_weak[: min(5, len(missing_or_weak))],
        'h1': missing_or_weak[: min(8, len(missing_or_weak))],
        'h2': missing_or_weak[:top_n],
        'content_gaps': missing_or_weak,
        'overused_content': overused,
    }


__all__ = [
    'TermRecommendation',
    'classify_term',
    'build_term_recommendations',
    'build_section_gaps',
]

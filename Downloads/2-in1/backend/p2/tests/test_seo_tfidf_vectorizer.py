from apps.services.seo_recommendations import build_term_recommendations


def test_build_term_recommendations_classifies_all_categories():
    target_scores = {
        "missing_term": 0.0,
        "weak_term": 0.02,
        "ok_term": 0.12,
        "overused_term": 0.45,
    }
    corpus_means = {
        "missing_term": 0.2,
        "weak_term": 0.2,
        "ok_term": 0.1,
        "overused_term": 0.2,
    }

    recommendations = build_term_recommendations(target_scores, corpus_means, threshold=0.05)
    categories = {item.term: item.category for item in recommendations}

    assert categories["missing_term"] == "missing"
    assert categories["weak_term"] == "weak"
    assert categories["ok_term"] == "ok"
    assert categories["overused_term"] == "overused"


def test_build_term_recommendations_sorted_by_gap_score_desc_abs():
    target_scores = {
        "small_gap": 0.09,
        "medium_gap": 0.01,
        "big_gap": 0.0,
    }
    corpus_means = {
        "small_gap": 0.1,
        "medium_gap": 0.2,
        "big_gap": 0.4,
    }

    recommendations = build_term_recommendations(target_scores, corpus_means, threshold=0.02)

    assert [item.term for item in recommendations] == ["big_gap", "medium_gap", "small_gap"]
    assert abs(recommendations[0].gap_score) >= abs(recommendations[1].gap_score) >= abs(recommendations[2].gap_score)

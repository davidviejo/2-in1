from apps.web.blueprints.seo_tool import cluster_serp_results


def test_cluster_serp_results_includes_overlap_evidence_urls():
    serp_data_map = {
        "keyword base": [
            {"url": "https://example.com/a", "title": "A"},
            {"url": "https://example.com/b", "title": "B"},
            {"url": "https://other.com/c", "title": "C"},
        ],
        "keyword variacion": [
            {"url": "https://example.com/a", "title": "A alt"},
            {"url": "https://example.com/b", "title": "B alt"},
            {"url": "https://new.com/d", "title": "D"},
        ],
    }

    clusters = cluster_serp_results(serp_data_map, strict_level=2)

    assert len(clusters) == 1
    evidence = clusters[0]["overlap_evidence"]
    assert evidence == [
        {
            "baseKeyword": "keyword base",
            "variationKeyword": "keyword variacion",
            "commonUrls": ["https://example.com/a", "https://example.com/b"],
            "commonDomains": [],
            "score": 2,
            "threshold": 2,
        }
    ]


def test_cluster_serp_results_strict_three_is_not_relaxed_for_similar_keywords():
    serp_data_map = {
        "implantes dentales madrid": [
            {"url": "https://example.com/a", "title": "A"},
            {"url": "https://example.com/b", "title": "B"},
            {"url": "https://other.com/c", "title": "C"},
        ],
        "implante dental madrid": [
            {"url": "https://example.com/a", "title": "A alt"},
            {"url": "https://example.com/b", "title": "B alt"},
            {"url": "https://new.com/d", "title": "D"},
        ],
    }

    clusters = cluster_serp_results(serp_data_map, strict_level=3)

    assert len(clusters) == 2
    assert all(cluster["children"] == [] for cluster in clusters)
    assert all(cluster["overlap_evidence"] == [] for cluster in clusters)


def test_cluster_serp_results_preserves_per_keyword_serps_for_reclustering():
    serp_data_map = {
        "keyword base": [
            {"url": "https://example.com/a", "title": "A"},
            {"url": "https://example.com/b", "title": "B"},
        ],
        "keyword variacion": [
            {"url": "https://example.com/a", "title": "A alt"},
            {"url": "https://example.com/b", "title": "B alt"},
        ],
    }

    clusters = cluster_serp_results(serp_data_map, strict_level=2)

    assert clusters[0]["keyword_serps"] == serp_data_map

from apps.web.blueprints.project_manager import merge_clusters_by_url


def test_merge_clusters_updates_existing_and_keeps_missing_attrs():
    existing = [
        {"name": "Cluster A", "url": "https://site.com/a", "target_kw": "kw-a"},
    ]
    imported = [
        {"name": "-", "url": "https://site.com/a", "target_kw": "kw-a-new"},
    ]

    result = merge_clusters_by_url(existing, imported)

    assert len(result) == 1
    assert result[0]["url"] == "https://site.com/a"
    assert result[0]["name"] == "Cluster A"
    assert result[0]["target_kw"] == "kw-a-new"


def test_merge_clusters_adds_new_urls_and_keeps_existing_not_in_import():
    existing = [
        {"name": "Cluster A", "url": "https://site.com/a", "target_kw": "kw-a"},
    ]
    imported = [
        {"name": "Cluster B", "url": "https://site.com/b", "target_kw": "kw-b"},
    ]

    result = merge_clusters_by_url(existing, imported)

    assert len(result) == 2
    by_url = {row["url"]: row for row in result}
    assert by_url["https://site.com/a"]["name"] == "Cluster A"
    assert by_url["https://site.com/b"]["name"] == "Cluster B"
    assert by_url["https://site.com/b"]["target_kw"] == "kw-b"


def test_merge_clusters_ignores_invalid_import_rows():
    existing = [
        {"name": "Cluster A", "url": "https://site.com/a", "target_kw": "kw-a"},
    ]
    imported = [
        {"name": "No URL", "url": "-", "target_kw": "x"},
        {"name": "No URL 2", "url": " ", "target_kw": "y"},
    ]

    result = merge_clusters_by_url(existing, imported)

    assert result == existing

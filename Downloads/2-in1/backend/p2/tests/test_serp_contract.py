from unittest.mock import patch

from apps.tools.credentials import resolve_dataforseo_credentials
from apps.tools.scraper_core import normalize_serp_config, smart_serp_search


def test_normalize_serp_config_accepts_legacy_aliases():
    cfg = normalize_serp_config({
        "mode": "google_api_official",
        "provider": "google_api_official",
        "dfs_login": "legacy-login",
        "dfs_pass": "legacy-pass",
        "cse_key": "legacy-key",
        "cse_cx": "legacy-cx",
    })

    assert cfg["mode"] == "google_official"
    assert cfg["serp_provider"] == "google_official"
    assert cfg["dataforseo_login"] == "legacy-login"
    assert cfg["dataforseo_password"] == "legacy-pass"
    assert cfg["google_cse_key"] == "legacy-key"
    assert cfg["google_cse_cx"] == "legacy-cx"


@patch("apps.tools.scraper_core.search_google_official")
def test_smart_serp_search_supports_google_mode_alias(mock_google):
    mock_google.return_value = [{"url": "https://example.com", "title": "ok", "snippet": "", "rank": 1}]

    result = smart_serp_search(
        "test keyword",
        config={"mode": "google_api_official", "cse_key": "k", "cse_cx": "cx"},
        num_results=1,
    )

    assert len(result) == 1
    mock_google.assert_called_once_with("test keyword", "k", "cx", 1, gl="es", hl="es")


@patch("apps.tools.scraper_core.search_dataforseo")
def test_smart_serp_search_prefers_canonical_dataforseo_keys(mock_dfs):
    mock_dfs.return_value = {
        "results": [{"url": "https://example.com", "title": "ok", "snippet": "", "rank": 1}],
        "execution_mode": "standard",
        "detail": "regular",
        "depth": 10,
        "estimated_cost": 0.0,
        "actual_cost": 0.0,
        "task_id": None,
        "elapsed_ms": 5.0,
    }

    result = smart_serp_search(
        "test keyword",
        config={
            "mode": "dataforseo",
            "dataforseo_login": "canonical-login",
            "dataforseo_password": "canonical-password",
        },
        num_results=1,
    )

    assert len(result) == 1
    mock_dfs.assert_called_once_with(
        "test keyword",
        "canonical-login",
        "canonical-password",
        1,
        "es",
        "es",
        detail="regular",
        execution_mode="standard",
        return_meta=True,
    )


@patch("apps.tools.scraper_core.scrape_google_serp")
def test_smart_serp_search_google_scraping_passes_gl_hl(mock_scrape):
    mock_scrape.return_value = [{"url": "https://example.com", "title": "ok"}]

    result = smart_serp_search(
        "test keyword",
        config={"mode": "google_scraping"},
        num_results=1,
        lang="en",
        country="us",
    )

    assert len(result) == 1
    mock_scrape.assert_called_once_with(
        "test keyword",
        1,
        2,
        cookie=None,
        gl="us",
        hl="en",
    )


def test_resolve_dataforseo_credentials_supports_canonical_override():
    with patch("apps.tools.credentials.get_user_settings", return_value={}):
        creds = resolve_dataforseo_credentials({
            "dataforseo_login": "canonical-login",
            "dataforseo_password": "canonical-password",
        })

    assert creds["login"] == "canonical-login"
    assert creds["password"] == "canonical-password"

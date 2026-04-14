from types import SimpleNamespace

from apps.web.blueprints import audit_tool


class DummyResponse(SimpleNamespace):
    pass


def _xml_response(content: str, status_code: int = 200):
    return DummyResponse(status_code=status_code, content=content.encode("utf-8"))


def test_fetch_sitemap_urls_urlset_simple(monkeypatch):
    root = "https://example.com/sitemap.xml"
    xml = """
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url><loc>https://example.com/a</loc></url>
      <url><loc>https://example.com/b</loc></url>
      <url><loc>https://example.com/a</loc></url>
    </urlset>
    """

    monkeypatch.setattr(audit_tool, "is_safe_url", lambda url: True)
    monkeypatch.setattr(audit_tool.requests, "get", lambda *args, **kwargs: _xml_response(xml))

    urls = audit_tool.fetch_sitemap_urls(root)

    assert set(urls) == {"https://example.com/a", "https://example.com/b"}


def test_fetch_sitemap_urls_sitemapindex_with_two_children(monkeypatch):
    root = "https://example.com/sitemap_index.xml"
    child_1 = "https://example.com/sitemap-1.xml"
    child_2 = "https://example.com/sitemap-2.xml"

    xml_map = {
        root: """
            <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
              <sitemap><loc>https://example.com/sitemap-1.xml</loc></sitemap>
              <sitemap><loc>https://example.com/sitemap-2.xml</loc></sitemap>
            </sitemapindex>
        """,
        child_1: """
            <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
              <url><loc>https://example.com/a</loc></url>
            </urlset>
        """,
        child_2: """
            <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
              <url><loc>https://example.com/b</loc></url>
            </urlset>
        """,
    }

    monkeypatch.setattr(audit_tool, "is_safe_url", lambda url: True)
    monkeypatch.setattr(
        audit_tool.requests,
        "get",
        lambda url, **kwargs: _xml_response(xml_map[url]),
    )

    urls = audit_tool.fetch_sitemap_urls(root)

    assert set(urls) == {"https://example.com/a", "https://example.com/b"}


def test_fetch_sitemap_urls_circular_sitemap_no_infinite_loop(monkeypatch):
    root = "https://example.com/a.xml"
    second = "https://example.com/b.xml"
    calls = []

    xml_map = {
        root: """
            <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
              <sitemap><loc>https://example.com/b.xml</loc></sitemap>
            </sitemapindex>
        """,
        second: """
            <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
              <sitemap><loc>https://example.com/a.xml</loc></sitemap>
            </sitemapindex>
        """,
    }

    monkeypatch.setattr(audit_tool, "is_safe_url", lambda url: True)

    def fake_get(url, **kwargs):
        calls.append(url)
        return _xml_response(xml_map[url])

    monkeypatch.setattr(audit_tool.requests, "get", fake_get)

    urls = audit_tool.fetch_sitemap_urls(root)

    assert urls == []
    assert calls.count(root) == 1
    assert calls.count(second) == 1


def test_fetch_sitemap_urls_deduplicates_between_children(monkeypatch):
    root = "https://example.com/sitemap_index.xml"

    xml_map = {
        root: """
            <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
              <sitemap><loc>https://example.com/sitemap-1.xml</loc></sitemap>
              <sitemap><loc>https://example.com/sitemap-2.xml</loc></sitemap>
            </sitemapindex>
        """,
        "https://example.com/sitemap-1.xml": """
            <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
              <url><loc>https://example.com/shared</loc></url>
              <url><loc>https://example.com/only-1</loc></url>
            </urlset>
        """,
        "https://example.com/sitemap-2.xml": """
            <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
              <url><loc>https://example.com/shared</loc></url>
              <url><loc>https://example.com/only-2</loc></url>
            </urlset>
        """,
    }

    monkeypatch.setattr(audit_tool, "is_safe_url", lambda url: True)
    monkeypatch.setattr(audit_tool.requests, "get", lambda url, **kwargs: _xml_response(xml_map[url]))

    urls = audit_tool.fetch_sitemap_urls(root)

    assert set(urls) == {
        "https://example.com/shared",
        "https://example.com/only-1",
        "https://example.com/only-2",
    }


def test_fetch_sitemap_urls_blocks_unsafe_child_sitemap(monkeypatch):
    root = "https://example.com/sitemap_index.xml"
    unsafe_child = "http://169.254.169.254/latest/meta-data.xml"
    safe_child = "https://example.com/sitemap-safe.xml"
    requested = []

    xml_map = {
        root: f"""
            <sitemapindex xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">
              <sitemap><loc>{unsafe_child}</loc></sitemap>
              <sitemap><loc>{safe_child}</loc></sitemap>
            </sitemapindex>
        """,
        safe_child: """
            <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
              <url><loc>https://example.com/final</loc></url>
            </urlset>
        """,
    }

    def fake_is_safe(url):
        return url != unsafe_child

    def fake_get(url, **kwargs):
        requested.append(url)
        return _xml_response(xml_map[url])

    monkeypatch.setattr(audit_tool, "is_safe_url", fake_is_safe)
    monkeypatch.setattr(audit_tool.requests, "get", fake_get)

    urls = audit_tool.fetch_sitemap_urls(root)

    assert set(urls) == {"https://example.com/final"}
    assert unsafe_child not in requested

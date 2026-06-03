import time

from apps.services.url_finder import (
    MAX_WORKERS_DEFAULT,
    MAX_WORKERS_LIMIT,
    analyze_html,
    count_term_occurrences,
    count_terms,
    domain_matches,
    normalize_domain,
    normalize_url,
    parse_list,
)


HTML = """
<html>
  <head><title>Test</title><script>marca oculto</script></head>
  <body>
    <h1>Marca X</h1>
    <p>La marca x aparece tres veces como MARCA.</p>
    <a href="https://partner.com/recurso">Partner principal</a>
    <a href="/interno">Interno</a>
    <a href="https://blog.partner.com/post#top" rel="nofollow">Partner blog</a>
  </body>
</html>
"""


class FakeResponse:
    status_code = 200
    text = HTML
    headers = {'content-type': 'text/html; charset=utf-8'}
    url = 'https://example.com/page'

    def raise_for_status(self):
        return None


def test_count_terms_is_case_and_accent_insensitive():
    assert count_terms('Árbol arbol ARBOL marca', ['arbol', 'Marca']) == {'arbol': 3, 'Marca': 1}
    assert count_term_occurrences('Producto X producto x', 'producto x') == 2


def test_parse_list_accepts_newlines_commas_and_semicolons():
    assert MAX_WORKERS_DEFAULT == 8
    assert MAX_WORKERS_LIMIT == 20
    assert parse_list('uno\ndos, tres;cuatro') == ['uno', 'dos', 'tres', 'cuatro']


def test_normalizers_accept_plain_inputs():
    assert normalize_url('example.com/path') == 'https://example.com/path'
    assert normalize_domain('https://www.Example.com:8443/path') == 'example.com'
    assert normalize_domain('sub.example.com') == 'sub.example.com'


def test_domain_matches_exact_and_subdomains_only():
    assert domain_matches('linkedin.com', 'linkedin.com')
    assert domain_matches('www.linkedin.com', 'linkedin.com')
    assert domain_matches('es.linkedin.com', 'linkedin.com')
    assert not domain_matches('evil-linkedin.com', 'linkedin.com')


def test_analyze_html_counts_terms_and_matching_link_domains():
    result = analyze_html('https://example.com/page', HTML, ['marca', 'x'], ['partner.com'])

    assert result['word_counts']['marca'] == 3
    assert result['term_counts']['x'] == 2
    assert result['domain_counts']['partner.com'] == 2
    assert result['total_domain_link_matches'] == 2
    assert result['matched_links'][1]['href'] == 'https://blog.partner.com/post'
    assert result['total_links'] == 3
    assert result['unique_link_domains_count'] == 3


def test_url_finder_sync_endpoint_uses_api_v1_alias(client, monkeypatch):
    monkeypatch.setattr('apps.services.url_finder.fetch_url', lambda url: FakeResponse())

    response = client.post(
        '/api/v1/url_finder/api/analyze',
        json={
            'urls': 'https://example.com/page',
            'words': 'marca',
            'domains': 'partner.com',
            'max_workers': MAX_WORKERS_LIMIT + 10,
        },
    )

    assert response.status_code == 200
    data = response.get_json()
    assert data['summary']['urls_ok'] == 1
    assert data['summary']['words']['marca'] == 3
    assert data['summary']['domains']['partner.com'] == 2
    assert data['results'][0]['input_index'] == 0


def test_url_finder_background_job_reports_progress_and_order(client, monkeypatch):
    monkeypatch.setattr('apps.services.url_finder.fetch_url', lambda url: FakeResponse())

    create_response = client.post(
        '/api/v1/url_finder/api/jobs',
        json={
            'urls': 'https://example.com/a\nhttps://example.com/b',
            'words': 'marca',
            'domains': 'partner.com',
            'max_workers': MAX_WORKERS_DEFAULT,
        },
    )

    assert create_response.status_code == 200
    job_id = create_response.get_json()['job_id']

    snapshot = None
    for _ in range(30):
        response = client.get(f'/api/v1/url_finder/api/jobs/{job_id}')
        snapshot = response.get_json()
        if snapshot['status'] == 'completed':
            break
        time.sleep(0.05)

    assert snapshot is not None
    assert snapshot['status'] == 'completed'
    assert snapshot['completed'] == 2
    assert snapshot['progress_percent'] == 100
    assert [item['input_index'] for item in snapshot['results']] == [0, 1]

from apps.web import create_app


def test_compare_serp_endpoint(monkeypatch):
    app = create_app()
    client = app.test_client()

    sample = {
        'url': 'https://example.com', 'title': 'T', 'h1': 'H', 'words': 500, 'imgs': 5,
        'headings': [{'tag': 'H2', 'text': 'a'}, {'tag': 'H3', 'text': 'b'}],
        'schema': {'types': ['Service'], 'json_ld_count': 1, 'microdata_count': 0, 'total_blocks': 1},
        'blocks': {'price': {'present': True}, 'cta': {'present': True}, 'faq': {'present': False}, 'reviews': {'present': True}, 'contact': {'present': True}, 'location': {'present': False}},
        'intent': {'primary_intent': 'transactional'},
        'page_classification': {'page_type': 'service_landing'},
        'issues': [],
        'seo_score': 70,
    }

    def fake_extract(url):
        out = dict(sample)
        out['url'] = url
        if 'target' in url:
            out['blocks'] = dict(sample['blocks'])
            out['blocks']['reviews'] = {'present': False}
            out['schema'] = {'types': [], 'json_ld_count': 0, 'microdata_count': 0, 'total_blocks': 0}
        return out

    monkeypatch.setattr('apps.web.blueprints.seo_tool._extract_enriched_page_data', fake_extract)

    rv = client.post('/seo/compare_serp', json={
        'target_url': 'https://target.com/page',
        'competitor_urls': ['https://comp1.com/page', 'https://comp2.com/page']
    })
    assert rv.status_code == 200
    data = rv.get_json()
    assert data['status'] == 'ok'
    assert data['serp_summary']['avg_words'] == 500
    assert any(g['block'] == 'reviews' for g in data['gaps']['blocks'])

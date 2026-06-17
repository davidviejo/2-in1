from apps.web.blueprints.maps_iframe_tool import extract_google_maps_iframe, group_maps_iframe_results, parse_urls


def test_extract_google_maps_iframe_finds_embed_code():
    html = '''
    <html><body>
      <iframe src="https://www.google.com/maps/embed?pb=!1m18" width="100%" height="400"></iframe>
    </body></html>
    '''

    iframe_code = extract_google_maps_iframe(html)

    assert iframe_code is not None
    assert 'google.com/maps/embed' in iframe_code
    assert 'height="400"' in iframe_code


def test_extract_google_maps_iframe_ignores_non_maps_iframes():
    html = '<iframe src="https://www.youtube.com/embed/example"></iframe>'

    assert extract_google_maps_iframe(html) is None


def test_parse_urls_accepts_lines_commas_and_deduplicates():
    raw_urls = 'https://example.com/contacto\nhttps://example.com/mapa, https://example.com/contacto'

    assert parse_urls(raw_urls) == ['https://example.com/contacto', 'https://example.com/mapa']


def test_group_maps_iframe_results_separates_urls_without_iframe():
    results = [
        {'url': 'https://example.com/contacto', 'has_maps_iframe': False, 'iframe_code': None},
        {'url': 'https://example.com/ubicacion', 'has_maps_iframe': True, 'iframe_code': '<iframe></iframe>'},
        {'url': 'https://example.com/oficina', 'has_maps_iframe': False, 'iframe_code': None},
    ]

    grouped = group_maps_iframe_results(results)

    assert [item['url'] for item in grouped['without_maps_iframe']] == [
        'https://example.com/contacto',
        'https://example.com/oficina',
    ]
    assert [item['url'] for item in grouped['with_maps_iframe']] == ['https://example.com/ubicacion']

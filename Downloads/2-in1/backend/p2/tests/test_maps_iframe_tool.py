from apps.web.blueprints.maps_iframe_tool import extract_google_maps_iframe, parse_urls


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

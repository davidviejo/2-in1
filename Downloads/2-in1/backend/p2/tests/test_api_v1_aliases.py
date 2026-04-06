from apps.web.api_routes_map import API_V1_PREFIX, LEGACY_TO_V1_ROUTES


def test_legacy_route_redirects_to_api_v1(client):
    response = client.post('/crawler/run', json={'url': 'https://example.com'})

    assert response.status_code == 307
    assert response.headers['Location'].endswith('/api/v1/crawler/run')


def test_api_v1_route_available(client):
    response = client.post(f'{API_V1_PREFIX}/crawler/run', json={})

    assert response.status_code == 400
    assert response.get_json()['error'] == 'URL missing'


def test_audit_alias_redirects(client):
    response = client.post('/audit/scan')

    assert response.status_code == 307
    assert response.headers['Location'].endswith('/api/v1/audit/scan')


def test_routes_map_contains_expected_entries():
    assert LEGACY_TO_V1_ROUTES['/crawler/run'] == '/api/v1/crawler/run'
    assert LEGACY_TO_V1_ROUTES['/audit/scan'] == '/api/v1/audit/scan'

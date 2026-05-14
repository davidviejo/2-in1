import json


def test_seo_dashboard_page_renders(client):
    response = client.get('/seo/')

    assert response.status_code == 200
    body = response.get_data(as_text=True)
    assert 'Cluster & Analisis SERP' in body


def test_seo_compare_serp_requires_payload(client):
    response = client.post(
        '/seo/compare_serp',
        data=json.dumps({}),
        content_type='application/json',
    )

    assert response.status_code == 400
    data = response.get_json()
    assert data['status'] == 'error'


def test_seo_analyze_cluster_unknown_id_returns_error_status(client):
    response = client.post(
        '/seo/analyze_cluster',
        data=json.dumps({'id': 'missing-cluster'}),
        content_type='application/json',
    )

    assert response.status_code == 200
    data = response.get_json()
    assert data['status'] == 'error'

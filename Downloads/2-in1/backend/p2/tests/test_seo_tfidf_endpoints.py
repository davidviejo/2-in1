from unittest.mock import patch

from apps.web.blueprints import seo_tfidf as seo_tfidf_module


def _create_project(client, name="Proyecto TFIDF"):
    response = client.post('/api/v1/seo/tfidf/projects', json={'name': name})
    assert response.status_code == 201
    return response.get_json()['id']


def _add_docs(client, project_id):
    return client.post(
        f'/api/v1/seo/tfidf/projects/{project_id}/documents',
        json={
            'documents': [
                {'title': 'Doc A', 'content': 'seo tecnico rastreo indexacion arquitectura interna'},
                {'title': 'Doc B', 'content': 'contenidos seo semantica entidades autoridad topical'},
            ]
        },
    )


def setup_function():
    seo_tfidf_module._PROJECTS.clear()
    seo_tfidf_module._RUNS.clear()


def test_seo_tfidf_create_add_analyze_get_run_and_persisted_metadata(client):
    with patch('requests.get') as mock_get:
        project_id = _create_project(client)

        add_response = _add_docs(client, project_id)
        assert add_response.status_code == 201
        assert add_response.get_json()['count'] == 2

        analyze_response = client.post(
            f'/api/v1/seo/tfidf/projects/{project_id}/analyze',
            json={
                'target_url': 'https://example.com/target',
                'reference_urls': ['https://example.com/r1', 'https://example.com/r2'],
                'config': {'min_df': 1, 'max_df': 1.0, 'max_features': 5000, 'ngram_range': [1, 2]},
            },
        )

        assert analyze_response.status_code == 202
        analyze_json = analyze_response.get_json()
        assert analyze_json['summary']
        assert isinstance(analyze_json['recommendations'], list)
        assert isinstance(analyze_json['terms'], list)

        run_id = analyze_json['run_id']
        run_response = client.get(f'/api/v1/seo/tfidf/runs/{run_id}')
        assert run_response.status_code == 200

        run_json = run_response.get_json()
        assert run_json['run_id'] == run_id
        assert run_json['project_id'] == project_id
        assert run_json['target_url'] == 'https://example.com/target'
        assert run_json['reference_urls'] == ['https://example.com/r1', 'https://example.com/r2']
        assert run_json['summary']
        assert isinstance(run_json['recommendations'], list)
        assert isinstance(run_json['terms'], list)
        assert run_json['created_at']
        assert run_json['documents_analyzed'] == 2

        mock_get.assert_not_called()


def test_seo_tfidf_endpoints_errors_400_422_504_simulated(client, monkeypatch):
    # 400 real: payload inválido para crear proyecto (campo extra)
    bad_create = client.post('/api/v1/seo/tfidf/projects', json={'name': 'x', 'extra': 'no-permitido'})
    assert bad_create.status_code == 400

    # 422 simulado: forzamos el parser para devolver un error 422
    def fake_parse_422(_schema_cls, _payload):
        return None, seo_tfidf_module._error_response('Payload semanticamente inválido (simulado).', 422)

    monkeypatch.setattr(seo_tfidf_module, '_parse_or_400', fake_parse_422)
    simulated_422 = client.post('/api/v1/seo/tfidf/projects', json={'name': 'Proyecto'})
    assert simulated_422.status_code == 422

    # 504 simulado: mismo enfoque para emular timeout de upstream
    def fake_parse_504(_schema_cls, _payload):
        return None, seo_tfidf_module._error_response('Timeout de proveedor externo (simulado).', 504)

    monkeypatch.setattr(seo_tfidf_module, '_parse_or_400', fake_parse_504)
    simulated_504 = client.post('/api/v1/seo/tfidf/projects', json={'name': 'Proyecto'})
    assert simulated_504.status_code == 504

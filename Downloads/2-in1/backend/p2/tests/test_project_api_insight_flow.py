import json

from apps.web.blueprints import project_api


def test_snapshot_persists_task_flow_metadata(client, tmp_path, monkeypatch):
    store_path = tmp_path / 'project_api_store.json'
    monkeypatch.setattr(project_api, '_STORE_FILE', str(store_path))

    payload = {
        'currentClientId': 'client-1',
        'clients': [
            {
                'id': 'client-1',
                'name': 'Cliente Demo',
                'vertical': 'media',
                'createdAt': 1,
                'modules': [
                    {
                        'id': 1,
                        'title': 'Módulo',
                        'subtitle': '',
                        'levelRange': '0-20',
                        'description': '',
                        'iconName': 'Target',
                        'tasks': [
                            {
                                'id': 'task-1',
                                'title': 'Optimizar query',
                                'description': 'test',
                                'impact': 'High',
                                'status': 'pending',
                                'isInCustomRoadmap': True,
                                'flow': {
                                    'finding': 'seo tecnico medios',
                                    'insight': {
                                        'id': 'quickWins',
                                        'title': 'Quick wins',
                                        'summary': 'sum',
                                        'reason': 'because',
                                    },
                                    'opportunityOrRisk': 'opportunity',
                                    'recommendedAction': 'Actualizar snippets',
                                    'evidence': [{'label': 'URL', 'value': 'https://example.com'}],
                                    'impact': {'score': 90, 'confidence': 80, 'opportunity': 70},
                                    'source': {'tool': 'seo_dashboard_gsc_insights'},
                                    'phase': 'phase1',
                                },
                            }
                        ],
                    }
                ],
            }
        ],
        'generalNotes': [],
    }

    put_response = client.put('/api/v1/project-api/snapshot', json=payload)
    assert put_response.status_code == 200

    tasks_response = client.get('/api/v1/project-api/tasks?clientId=client-1')
    assert tasks_response.status_code == 200
    data = tasks_response.get_json()
    assert data['items'][0]['flow']['finding'] == 'seo tecnico medios'
    assert data['items'][0]['flow']['source']['tool'] == 'seo_dashboard_gsc_insights'

    persisted = json.loads(store_path.read_text(encoding='utf-8'))
    assert persisted['clients'][0]['modules'][0]['tasks'][0]['flow']['phase'] == 'phase1'

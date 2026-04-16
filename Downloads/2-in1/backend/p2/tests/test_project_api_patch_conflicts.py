from apps.web.blueprints import project_api


def _seed_snapshot(client):
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
                            }
                        ],
                    }
                ],
                'notes': [
                    {
                        'id': 'note-1',
                        'content': 'nota inicial',
                        'createdAt': 10,
                    }
                ],
            }
        ],
        'generalNotes': [],
    }
    response = client.put('/api/v1/project-api/snapshot', json=payload)
    assert response.status_code == 200
    return response.get_json()


def test_patch_note_and_task_from_two_tabs_preserves_both_updates(client, tmp_path, monkeypatch):
    store_path = tmp_path / 'project_api_store.json'
    monkeypatch.setattr(project_api, '_STORE_FILE', str(store_path))
    initial = _seed_snapshot(client)

    tab_a_response = client.patch(
        '/api/v1/project-api/notes/note-1',
        json={
            'scope': 'client',
            'clientId': 'client-1',
            'patch': {'content': 'nota editada en pestaña A'},
            'expectedVersion': initial['version'],
            'originClientId': 'tab-A',
            'updatedFields': ['content'],
        },
    )
    assert tab_a_response.status_code == 200

    # Simula una segunda pestaña que parte de la misma versión previa.
    tab_b_response = client.patch(
        '/api/v1/project-api/tasks/task-1',
        json={
            'clientId': 'client-1',
            'moduleId': 1,
            'patch': {'status': 'completed'},
            'expectedVersion': initial['version'],
            'originClientId': 'tab-B',
            'updatedFields': ['status'],
        },
    )
    assert tab_b_response.status_code == 200

    snapshot_response = client.get('/api/v1/project-api/snapshot')
    snapshot = snapshot_response.get_json()
    assert snapshot_response.status_code == 200
    assert snapshot['clients'][0]['notes'][0]['content'] == 'nota editada en pestaña A'
    assert snapshot['clients'][0]['modules'][0]['tasks'][0]['status'] == 'completed'


def test_patch_conflict_response_includes_origin_and_updated_fields(client, tmp_path, monkeypatch):
    store_path = tmp_path / 'project_api_store.json'
    monkeypatch.setattr(project_api, '_STORE_FILE', str(store_path))
    initial = _seed_snapshot(client)

    first_edit = client.patch(
        '/api/v1/project-api/tasks/task-1',
        json={
            'clientId': 'client-1',
            'moduleId': 1,
            'patch': {'status': 'completed'},
            'expectedVersion': initial['version'],
            'originClientId': 'tab-A',
            'updatedFields': ['status'],
        },
    )
    assert first_edit.status_code == 200

    conflict = client.patch(
        '/api/v1/project-api/tasks/task-1',
        json={
            'clientId': 'client-1',
            'moduleId': 1,
            'patch': {'status': 'pending'},
            'expectedVersion': initial['version'],
            'originClientId': 'tab-B',
            'updatedFields': ['status'],
        },
    )
    assert conflict.status_code == 409
    payload = conflict.get_json()
    assert payload['error'] == 'version_conflict'
    assert payload['conflict']['originClientId'] == 'tab-B'
    assert payload['conflict']['updatedFields'] == ['status']
    assert payload['conflict']['lastMutation']['originClientId'] == 'tab-A'

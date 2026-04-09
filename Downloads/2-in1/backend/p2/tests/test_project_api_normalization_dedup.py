from apps.web.blueprints.project_api import _normalize_snapshot


def test_normalize_snapshot_dedupes_module_tasks_and_custom_roadmap_order():
    raw_snapshot = {
        'clients': [
            {
                'id': 'client-1',
                'name': 'Cliente Demo',
                'modules': [
                    {
                        'id': 1,
                        'title': 'Módulo 1',
                        'tasks': [
                            {'id': 'task-1', 'title': 'Primera aparición'},
                            {'id': 'task-1', 'title': 'Duplicada debe descartarse'},
                            {'id': 'task-2', 'title': 'Única'},
                        ],
                    }
                ],
                'customRoadmapOrder': ['task-2', 'task-2', 'task-1', 'task-1'],
            }
        ]
    }

    normalized = _normalize_snapshot(raw_snapshot)
    client = normalized['clients'][0]
    module_tasks = client['modules'][0]['tasks']

    assert [task['id'] for task in module_tasks] == ['task-1', 'task-2']
    assert module_tasks[0]['title'] == 'Primera aparición'
    assert client['customRoadmapOrder'] == ['task-2', 'task-1']

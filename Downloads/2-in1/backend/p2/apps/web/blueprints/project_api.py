import json
import os
import threading
import time
from copy import deepcopy
from typing import Any, Dict, List

from flask import Blueprint, jsonify, request

project_api_bp = Blueprint('project_api_bp', __name__, url_prefix='/api/v1/project-api')

_STORE_FILE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
    'data',
    'project_api_store.json',
)

_LOCK = threading.Lock()


def _default_snapshot() -> Dict[str, Any]:
    now = int(time.time() * 1000)
    return {
        'version': 1,
        'updatedAt': now,
        'currentClientId': '',
        'clients': [],
        'generalNotes': [],
    }


def _load_store() -> Dict[str, Any]:
    if not os.path.exists(_STORE_FILE):
        return _default_snapshot()

    try:
        with open(_STORE_FILE, 'r', encoding='utf-8') as f:
            parsed = json.load(f)
            if isinstance(parsed, dict):
                return _normalize_snapshot(parsed)
    except (json.JSONDecodeError, OSError):
        return _default_snapshot()
    return _default_snapshot()


def _save_store(payload: Dict[str, Any]) -> None:
    os.makedirs(os.path.dirname(_STORE_FILE), exist_ok=True)
    with open(_STORE_FILE, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)


def _normalize_note(raw: Dict[str, Any]) -> Dict[str, Any]:
    return {
        'id': str(raw.get('id', '')),
        'content': str(raw.get('content', '')),
        'createdAt': int(raw.get('createdAt', int(time.time() * 1000))),
        'updatedAt': int(raw.get('updatedAt')) if isinstance(raw.get('updatedAt'), int) else None,
    }


def _normalize_task(raw: Dict[str, Any]) -> Dict[str, Any]:
    raw_flow = raw.get('flow')
    normalized_flow = raw_flow if isinstance(raw_flow, dict) else None
    return {
        'id': str(raw.get('id', '')),
        'title': str(raw.get('title', '')),
        'description': str(raw.get('description', '')),
        'impact': str(raw.get('impact', 'Low')),
        'status': str(raw.get('status', 'pending')),
        'category': raw.get('category'),
        'isCustom': bool(raw.get('isCustom')) if 'isCustom' in raw else None,
        'isInCustomRoadmap': bool(raw.get('isInCustomRoadmap')) if 'isInCustomRoadmap' in raw else None,
        'userNotes': raw.get('userNotes'),
        'communicated': bool(raw.get('communicated')) if 'communicated' in raw else None,
        'externalLink': raw.get('externalLink'),
        'assignee': raw.get('assignee'),
        'dueDate': raw.get('dueDate'),
        'flow': normalized_flow,
    }


def _compact_nones(item: Any) -> Any:
    if isinstance(item, list):
        return [_compact_nones(x) for x in item]
    if isinstance(item, dict):
        return {k: _compact_nones(v) for k, v in item.items() if v is not None}
    return item


def _dedupe_stable_strings(values: List[Any]) -> List[str]:
    seen = set()
    deduped: List[str] = []
    for value in values:
        normalized = str(value)
        if normalized in seen:
            continue
        seen.add(normalized)
        deduped.append(normalized)
    return deduped


def _normalize_module(raw: Dict[str, Any]) -> Dict[str, Any]:
    normalized_tasks = [_compact_nones(_normalize_task(task)) for task in raw.get('tasks', []) if isinstance(task, dict)]
    seen_task_ids = set()
    deduped_tasks: List[Dict[str, Any]] = []
    for task in normalized_tasks:
        task_id = str(task.get('id', ''))
        if task_id in seen_task_ids:
            continue
        seen_task_ids.add(task_id)
        deduped_tasks.append(task)

    return {
        'id': int(raw.get('id', 0)),
        'title': str(raw.get('title', '')),
        'subtitle': str(raw.get('subtitle', '')),
        'levelRange': str(raw.get('levelRange', '')),
        'description': str(raw.get('description', '')),
        'iconName': str(raw.get('iconName', '')), 
        'tasks': deduped_tasks,
        'isCustom': bool(raw.get('isCustom')) if 'isCustom' in raw else None,
    }


def _normalize_client(raw: Dict[str, Any]) -> Dict[str, Any]:
    return _compact_nones({
        'id': str(raw.get('id', '')),
        'name': str(raw.get('name', '')),
        'vertical': str(raw.get('vertical', 'media')),
        'modules': [_normalize_module(m) for m in raw.get('modules', []) if isinstance(m, dict)],
        'createdAt': int(raw.get('createdAt', int(time.time() * 1000))),
        'notes': [_normalize_note(n) for n in raw.get('notes', []) if isinstance(n, dict)],
        'completedTasksLog': raw.get('completedTasksLog', []),
        'customRoadmapOrder': _dedupe_stable_strings(raw.get('customRoadmapOrder', [])),
        'aiRoadmap': [_compact_nones(_normalize_task(task)) for task in raw.get('aiRoadmap', []) if isinstance(task, dict)],
        'kanbanColumns': raw.get('kanbanColumns', []),
        'iaVisibility': raw.get('iaVisibility'),
    })


def _normalize_snapshot(raw: Dict[str, Any]) -> Dict[str, Any]:
    base = _default_snapshot()
    return {
        'version': int(raw.get('version', base['version'])),
        'updatedAt': int(raw.get('updatedAt', base['updatedAt'])),
        'currentClientId': str(raw.get('currentClientId', '')),
        'clients': [_normalize_client(client) for client in raw.get('clients', []) if isinstance(client, dict)],
        'generalNotes': [_normalize_note(note) for note in raw.get('generalNotes', []) if isinstance(note, dict)],
    }


@project_api_bp.route('/snapshot', methods=['GET'])
def get_snapshot():
    with _LOCK:
        snapshot = _load_store()
    return jsonify(snapshot)


@project_api_bp.route('/snapshot', methods=['PUT'])
def put_snapshot():
    data = request.get_json(silent=True) or {}
    incoming = _normalize_snapshot(data)
    expected_version = data.get('expectedVersion')

    with _LOCK:
        current = _load_store()
        if expected_version is not None and int(expected_version) != int(current.get('version', 1)):
            return jsonify({
                'error': 'version_conflict',
                'message': 'The snapshot was updated by another client.',
                'serverSnapshot': current,
            }), 409

        incoming['version'] = int(current.get('version', 1)) + 1
        incoming['updatedAt'] = int(time.time() * 1000)
        _save_store(incoming)

    return jsonify(incoming)


@project_api_bp.route('/clients', methods=['GET'])
def list_clients():
    with _LOCK:
        snapshot = _load_store()
    return jsonify({'items': snapshot['clients'], 'updatedAt': snapshot['updatedAt']})


@project_api_bp.route('/projects', methods=['GET'])
def list_projects():
    with _LOCK:
        snapshot = _load_store()

    projects = [
        {
            'id': c.get('id', ''),
            'name': c.get('name', ''),
            'vertical': c.get('vertical', 'media'),
            'createdAt': c.get('createdAt'),
            'updatedAt': snapshot['updatedAt'],
            'version': snapshot['version'],
        }
        for c in snapshot['clients']
    ]
    return jsonify({'items': projects})


@project_api_bp.route('/tasks', methods=['GET'])
def list_tasks():
    client_id = request.args.get('clientId', '').strip()
    with _LOCK:
        snapshot = _load_store()

    all_tasks: List[Dict[str, Any]] = []
    for client in snapshot['clients']:
        if client_id and client.get('id') != client_id:
            continue
        for module in client.get('modules', []):
            for task in module.get('tasks', []):
                task_item = deepcopy(task)
                task_item['clientId'] = client.get('id')
                task_item['moduleId'] = module.get('id')
                all_tasks.append(task_item)

    return jsonify({'items': all_tasks, 'updatedAt': snapshot['updatedAt']})


@project_api_bp.route('/notes', methods=['GET'])
def list_notes():
    scope = request.args.get('scope', 'all').strip().lower()
    client_id = request.args.get('clientId', '').strip()

    with _LOCK:
        snapshot = _load_store()

    notes: List[Dict[str, Any]] = []

    if scope in ('all', 'general'):
        notes.extend([{**note, 'scope': 'general'} for note in snapshot.get('generalNotes', [])])

    if scope in ('all', 'client'):
        for client in snapshot['clients']:
            if client_id and client.get('id') != client_id:
                continue
            client_notes = client.get('notes', [])
            notes.extend([{**note, 'scope': 'client', 'clientId': client.get('id')} for note in client_notes])

    return jsonify({'items': notes, 'updatedAt': snapshot['updatedAt']})

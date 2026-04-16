import json
import os
import threading
import time
from copy import deepcopy
from typing import Any, Dict, List, Optional

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
        'lastMutation': None,
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




def _normalize_updated_fields(values: Any) -> List[str]:
    if not isinstance(values, list):
        return []
    normalized: List[str] = []
    seen = set()
    for value in values:
        if not isinstance(value, str):
            continue
        item = value.strip()
        if not item or item in seen:
            continue
        seen.add(item)
        normalized.append(item)
    return normalized


def _build_mutation_meta(
    *,
    origin_client_id: str,
    resource: str,
    resource_id: str,
    updated_fields: List[str],
    base_version: int,
    new_version: int,
) -> Dict[str, Any]:
    return {
        'originClientId': origin_client_id,
        'resource': resource,
        'resourceId': resource_id,
        'updatedFields': updated_fields,
        'baseVersion': base_version,
        'newVersion': new_version,
        'updatedAt': int(time.time() * 1000),
    }


def _updated_fields_overlap(first: List[str], second: List[str]) -> bool:
    return bool(set(first).intersection(second))


def _validate_expected_version(
    *,
    expected_version: Optional[int],
    current_snapshot: Dict[str, Any],
    resource: str,
    resource_id: str,
    updated_fields: List[str],
    origin_client_id: str,
) -> Optional[Any]:
    current_version = int(current_snapshot.get('version', 1))
    if expected_version is None or expected_version == current_version:
        return None

    last_mutation = current_snapshot.get('lastMutation')
    can_auto_merge = (
        isinstance(last_mutation, dict)
        and int(last_mutation.get('baseVersion', -1)) == int(expected_version)
        and str(last_mutation.get('resource', '')) == resource
        and str(last_mutation.get('resourceId', '')) == resource_id
        and not _updated_fields_overlap(updated_fields, _normalize_updated_fields(last_mutation.get('updatedFields')))
    )

    if can_auto_merge:
        return None

    return jsonify({
        'error': 'version_conflict',
        'message': 'The snapshot was updated by another client.',
        'serverSnapshot': current_snapshot,
        'conflict': {
            'originClientId': origin_client_id,
            'resource': resource,
            'resourceId': resource_id,
            'updatedFields': updated_fields,
            'expectedVersion': expected_version,
            'currentVersion': current_version,
            'lastMutation': last_mutation,
        },
    }), 409


def _find_client(snapshot: Dict[str, Any], client_id: str) -> Optional[Dict[str, Any]]:
    for client in snapshot.get('clients', []):
        if client.get('id') == client_id:
            return client
    return None


def _save_snapshot_with_meta(snapshot: Dict[str, Any], mutation_meta: Dict[str, Any]) -> Dict[str, Any]:
    current_version = int(snapshot.get('version', 1))
    snapshot['version'] = current_version + 1
    snapshot['updatedAt'] = int(time.time() * 1000)
    snapshot['lastMutation'] = mutation_meta
    _save_store(snapshot)
    return snapshot


def _extract_patch_request_metadata(data: Dict[str, Any]) -> Dict[str, Any]:
    expected_version_raw = data.get('expectedVersion')
    expected_version = int(expected_version_raw) if expected_version_raw is not None else None

    return {
        'expectedVersion': expected_version,
        'originClientId': str(data.get('originClientId', '')).strip(),
        'updatedFields': _normalize_updated_fields(data.get('updatedFields')),
    }

def _normalize_snapshot(raw: Dict[str, Any]) -> Dict[str, Any]:
    base = _default_snapshot()
    return {
        'version': int(raw.get('version', base['version'])),
        'updatedAt': int(raw.get('updatedAt', base['updatedAt'])),
        'currentClientId': str(raw.get('currentClientId', '')),
        'clients': [_normalize_client(client) for client in raw.get('clients', []) if isinstance(client, dict)],
        'generalNotes': [_normalize_note(note) for note in raw.get('generalNotes', []) if isinstance(note, dict)],
        'lastMutation': raw.get('lastMutation') if isinstance(raw.get('lastMutation'), dict) else None,
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
    metadata = _extract_patch_request_metadata(data)

    with _LOCK:
        current = _load_store()
        conflict_response = _validate_expected_version(
            expected_version=metadata['expectedVersion'],
            current_snapshot=current,
            resource='snapshot',
            resource_id='project',
            updated_fields=metadata['updatedFields'],
            origin_client_id=metadata['originClientId'],
        )
        if conflict_response is not None:
            return conflict_response

        incoming['version'] = int(current.get('version', 1))
        mutation_meta = _build_mutation_meta(
            origin_client_id=metadata['originClientId'],
            resource='snapshot',
            resource_id='project',
            updated_fields=metadata['updatedFields'],
            base_version=int(current.get('version', 1)),
            new_version=int(current.get('version', 1)) + 1,
        )
        saved = _save_snapshot_with_meta(incoming, mutation_meta)

    return jsonify(saved)


@project_api_bp.route('/clients/<client_id>', methods=['PATCH'])
def patch_client(client_id: str):
    data = request.get_json(silent=True) or {}
    patch = data.get('patch') if isinstance(data.get('patch'), dict) else {}
    metadata = _extract_patch_request_metadata(data)

    allowed_fields = {'name', 'vertical', 'kanbanColumns', 'customRoadmapOrder', 'iaVisibility'}

    with _LOCK:
        snapshot = _load_store()
        client = _find_client(snapshot, client_id)
        if client is None:
            return jsonify({'error': 'not_found', 'message': 'Client not found.'}), 404

        conflict_response = _validate_expected_version(
            expected_version=metadata['expectedVersion'],
            current_snapshot=snapshot,
            resource='client',
            resource_id=client_id,
            updated_fields=metadata['updatedFields'],
            origin_client_id=metadata['originClientId'],
        )
        if conflict_response is not None:
            return conflict_response

        for field in allowed_fields:
            if field in patch:
                if field == 'customRoadmapOrder':
                    client[field] = _dedupe_stable_strings(patch[field])
                else:
                    client[field] = patch[field]

        if 'currentClientId' in patch:
            snapshot['currentClientId'] = str(patch.get('currentClientId') or '')

        mutation_meta = _build_mutation_meta(
            origin_client_id=metadata['originClientId'],
            resource='client',
            resource_id=client_id,
            updated_fields=metadata['updatedFields'],
            base_version=int(snapshot.get('version', 1)),
            new_version=int(snapshot.get('version', 1)) + 1,
        )
        saved = _save_snapshot_with_meta(snapshot, mutation_meta)

    return jsonify(saved)


@project_api_bp.route('/notes/<note_id>', methods=['PATCH'])
def patch_note(note_id: str):
    data = request.get_json(silent=True) or {}
    patch = data.get('patch') if isinstance(data.get('patch'), dict) else {}
    metadata = _extract_patch_request_metadata(data)
    scope = str(data.get('scope', 'general')).strip().lower()
    client_id = str(data.get('clientId', '')).strip()

    with _LOCK:
        snapshot = _load_store()

        if scope == 'general':
            notes = snapshot.get('generalNotes', [])
            note = next((n for n in notes if n.get('id') == note_id), None)
        else:
            client = _find_client(snapshot, client_id)
            if client is None:
                return jsonify({'error': 'not_found', 'message': 'Client not found.'}), 404
            notes = client.get('notes', [])
            note = next((n for n in notes if n.get('id') == note_id), None)

        if note is None:
            return jsonify({'error': 'not_found', 'message': 'Note not found.'}), 404

        resource_id = f'{scope}:{client_id or "global"}:{note_id}'
        conflict_response = _validate_expected_version(
            expected_version=metadata['expectedVersion'],
            current_snapshot=snapshot,
            resource='note',
            resource_id=resource_id,
            updated_fields=metadata['updatedFields'],
            origin_client_id=metadata['originClientId'],
        )
        if conflict_response is not None:
            return conflict_response

        if 'content' in patch:
            note['content'] = str(patch.get('content', ''))
        note['updatedAt'] = int(time.time() * 1000)

        mutation_meta = _build_mutation_meta(
            origin_client_id=metadata['originClientId'],
            resource='note',
            resource_id=resource_id,
            updated_fields=metadata['updatedFields'],
            base_version=int(snapshot.get('version', 1)),
            new_version=int(snapshot.get('version', 1)) + 1,
        )
        saved = _save_snapshot_with_meta(snapshot, mutation_meta)

    return jsonify(saved)


@project_api_bp.route('/tasks/<task_id>', methods=['PATCH'])
def patch_task(task_id: str):
    data = request.get_json(silent=True) or {}
    patch = data.get('patch') if isinstance(data.get('patch'), dict) else {}
    metadata = _extract_patch_request_metadata(data)
    client_id = str(data.get('clientId', '')).strip()
    module_id_raw = data.get('moduleId')
    module_id = int(module_id_raw) if module_id_raw is not None else None

    with _LOCK:
        snapshot = _load_store()
        client = _find_client(snapshot, client_id)
        if client is None:
            return jsonify({'error': 'not_found', 'message': 'Client not found.'}), 404

        target_task = None
        for module in client.get('modules', []):
            if module_id is not None and int(module.get('id', -1)) != module_id:
                continue
            for task in module.get('tasks', []):
                if task.get('id') == task_id:
                    target_task = task
                    break
            if target_task is not None:
                break

        if target_task is None:
            return jsonify({'error': 'not_found', 'message': 'Task not found.'}), 404

        resource_id = f'{client_id}:{module_id if module_id is not None else "*"}:{task_id}'
        conflict_response = _validate_expected_version(
            expected_version=metadata['expectedVersion'],
            current_snapshot=snapshot,
            resource='task',
            resource_id=resource_id,
            updated_fields=metadata['updatedFields'],
            origin_client_id=metadata['originClientId'],
        )
        if conflict_response is not None:
            return conflict_response

        for key, value in patch.items():
            target_task[key] = value

        mutation_meta = _build_mutation_meta(
            origin_client_id=metadata['originClientId'],
            resource='task',
            resource_id=resource_id,
            updated_fields=metadata['updatedFields'],
            base_version=int(snapshot.get('version', 1)),
            new_version=int(snapshot.get('version', 1)) + 1,
        )
        saved = _save_snapshot_with_meta(snapshot, mutation_meta)

    return jsonify(saved)


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

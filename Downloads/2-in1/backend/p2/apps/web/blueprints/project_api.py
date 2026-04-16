import json
import logging
import os
import threading
import time
from copy import deepcopy
from typing import Any, Dict, List, Optional

from flask import Blueprint, jsonify, request

from apps.core.database import USE_POSTGRES, get_db_connection

project_api_bp = Blueprint('project_api_bp', __name__, url_prefix='/api/v1/project-api')

_STORE_FILE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
    'data',
    'project_api_store.json',
)

_LOCK = threading.Lock()
_METRICS: Dict[str, float] = {
    'read_ops': 0,
    'read_total_ms': 0.0,
    'write_ops': 0,
    'write_total_ms': 0.0,
    'version_conflicts': 0,
}


def _record_metric(metric_name: str, value: float = 1.0) -> None:
    _METRICS[metric_name] = _METRICS.get(metric_name, 0.0) + value


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


def _to_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


def _from_json(value: Optional[str], fallback: Any) -> Any:
    if not value:
        return fallback
    try:
        return json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return fallback


def _enable_foreign_keys_if_needed(cursor: Any) -> None:
    if not USE_POSTGRES:
        cursor.execute('PRAGMA foreign_keys = ON;')


def _mark_project_api_migration(cursor: Any, value: str) -> None:
    cursor.execute('DELETE FROM project_api_meta WHERE key = ?', ('project_api_json_migration',))
    cursor.execute(
        'INSERT INTO project_api_meta (key, value) VALUES (?, ?)',
        ('project_api_json_migration', value),
    )


def _get_project_api_migration_state(cursor: Any) -> Optional[str]:
    cursor.execute('SELECT value FROM project_api_meta WHERE key = ?', ('project_api_json_migration',))
    row = cursor.fetchone()
    if row is None:
        return None
    try:
        return row['value']
    except (TypeError, KeyError):
        return row[0]


def _insert_snapshot_into_db(cursor: Any, snapshot: Dict[str, Any]) -> None:
    cursor.execute('DELETE FROM project_api_tasks')
    cursor.execute('DELETE FROM project_api_modules')
    cursor.execute('DELETE FROM project_api_notes')
    cursor.execute('DELETE FROM project_api_clients')

    cursor.execute(
        '''
        INSERT INTO project_api_snapshot_state (id, version, updated_at, current_client_id, last_mutation_json)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT (id) DO UPDATE SET
            version = excluded.version,
            updated_at = excluded.updated_at,
            current_client_id = excluded.current_client_id,
            last_mutation_json = excluded.last_mutation_json
        ''',
        (
            1,
            int(snapshot.get('version', 1)),
            int(snapshot.get('updatedAt', int(time.time() * 1000))),
            str(snapshot.get('currentClientId', '')),
            _to_json(snapshot.get('lastMutation')) if snapshot.get('lastMutation') is not None else None,
        ),
    )

    for client in snapshot.get('clients', []):
        cursor.execute(
            '''
            INSERT INTO project_api_clients (
                id, name, vertical, created_at, completed_tasks_log_json,
                custom_roadmap_order_json, ai_roadmap_json, kanban_columns_json, ia_visibility_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''',
            (
                str(client.get('id', '')),
                str(client.get('name', '')),
                str(client.get('vertical', 'media')),
                int(client.get('createdAt', int(time.time() * 1000))),
                _to_json(client.get('completedTasksLog', [])),
                _to_json(client.get('customRoadmapOrder', [])),
                _to_json(client.get('aiRoadmap', [])),
                _to_json(client.get('kanbanColumns', [])),
                _to_json(client.get('iaVisibility')) if 'iaVisibility' in client else None,
            ),
        )

        for module in client.get('modules', []):
            cursor.execute(
                '''
                INSERT INTO project_api_modules (
                    client_id, module_id, title, subtitle, level_range,
                    description, icon_name, is_custom
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''',
                (
                    str(client.get('id', '')),
                    int(module.get('id', 0)),
                    str(module.get('title', '')),
                    str(module.get('subtitle', '')),
                    str(module.get('levelRange', '')),
                    str(module.get('description', '')),
                    str(module.get('iconName', '')),
                    1 if bool(module.get('isCustom')) else 0 if 'isCustom' in module else None,
                ),
            )
            for task in module.get('tasks', []):
                cursor.execute(
                    '''
                    INSERT INTO project_api_tasks (client_id, module_id, task_id, task_json)
                    VALUES (?, ?, ?, ?)
                    ''',
                    (
                        str(client.get('id', '')),
                        int(module.get('id', 0)),
                        str(task.get('id', '')),
                        _to_json(task),
                    ),
                )

        for note in client.get('notes', []):
            cursor.execute(
                '''
                INSERT INTO project_api_notes (
                    note_id, scope, client_id, content, created_at, updated_at, extra_json
                ) VALUES (?, 'client', ?, ?, ?, ?, ?)
                ''',
                (
                    str(note.get('id', '')),
                    str(client.get('id', '')),
                    str(note.get('content', '')),
                    int(note.get('createdAt', int(time.time() * 1000))),
                    int(note.get('updatedAt')) if isinstance(note.get('updatedAt'), int) else None,
                    _to_json({
                        k: v
                        for k, v in note.items()
                        if k not in {'id', 'content', 'createdAt', 'updatedAt'}
                    }),
                ),
            )

    for note in snapshot.get('generalNotes', []):
        cursor.execute(
            '''
            INSERT INTO project_api_notes (
                note_id, scope, client_id, content, created_at, updated_at, extra_json
            ) VALUES (?, 'general', NULL, ?, ?, ?, ?)
            ''',
            (
                str(note.get('id', '')),
                str(note.get('content', '')),
                int(note.get('createdAt', int(time.time() * 1000))),
                int(note.get('updatedAt')) if isinstance(note.get('updatedAt'), int) else None,
                _to_json({
                    k: v
                    for k, v in note.items()
                    if k not in {'id', 'content', 'createdAt', 'updatedAt'}
                }),
            ),
        )


def _load_snapshot_from_db(cursor: Any) -> Dict[str, Any]:
    cursor.execute(
        'SELECT version, updated_at, current_client_id, last_mutation_json FROM project_api_snapshot_state WHERE id = 1'
    )
    state_row = cursor.fetchone()
    if state_row is None:
        return _default_snapshot()

    snapshot: Dict[str, Any] = {
        'version': int(state_row['version']),
        'updatedAt': int(state_row['updated_at']),
        'currentClientId': str(state_row['current_client_id'] or ''),
        'clients': [],
        'generalNotes': [],
        'lastMutation': _from_json(state_row['last_mutation_json'], None),
    }

    cursor.execute(
        '''
        SELECT id, name, vertical, created_at, completed_tasks_log_json, custom_roadmap_order_json,
               ai_roadmap_json, kanban_columns_json, ia_visibility_json
        FROM project_api_clients
        ORDER BY created_at ASC, id ASC
        '''
    )
    client_rows = cursor.fetchall()

    clients_by_id: Dict[str, Dict[str, Any]] = {}
    for row in client_rows:
        client = _compact_nones({
            'id': str(row['id']),
            'name': str(row['name']),
            'vertical': str(row['vertical'] or 'media'),
            'createdAt': int(row['created_at']) if row['created_at'] is not None else int(time.time() * 1000),
            'modules': [],
            'notes': [],
            'completedTasksLog': _from_json(row['completed_tasks_log_json'], []),
            'customRoadmapOrder': _dedupe_stable_strings(_from_json(row['custom_roadmap_order_json'], [])),
            'aiRoadmap': [_compact_nones(_normalize_task(t)) for t in _from_json(row['ai_roadmap_json'], []) if isinstance(t, dict)],
            'kanbanColumns': _from_json(row['kanban_columns_json'], []),
            'iaVisibility': _from_json(row['ia_visibility_json'], None),
        })
        clients_by_id[client['id']] = client
        snapshot['clients'].append(client)

    cursor.execute(
        '''
        SELECT client_id, module_id, title, subtitle, level_range, description, icon_name, is_custom
        FROM project_api_modules
        ORDER BY client_id ASC, module_id ASC
        '''
    )
    module_rows = cursor.fetchall()
    modules_by_client_module: Dict[str, Dict[int, Dict[str, Any]]] = {}

    for row in module_rows:
        client_id = str(row['client_id'])
        client = clients_by_id.get(client_id)
        if client is None:
            continue
        module = _compact_nones({
            'id': int(row['module_id']),
            'title': str(row['title'] or ''),
            'subtitle': str(row['subtitle'] or ''),
            'levelRange': str(row['level_range'] or ''),
            'description': str(row['description'] or ''),
            'iconName': str(row['icon_name'] or ''),
            'tasks': [],
            'isCustom': bool(row['is_custom']) if row['is_custom'] is not None else None,
        })
        client['modules'].append(module)
        modules_by_client_module.setdefault(client_id, {})[int(row['module_id'])] = module

    cursor.execute(
        '''
        SELECT client_id, module_id, task_json
        FROM project_api_tasks
        ORDER BY client_id ASC, module_id ASC, id ASC
        '''
    )
    for row in cursor.fetchall():
        client_id = str(row['client_id'])
        module_id = int(row['module_id'])
        module = modules_by_client_module.get(client_id, {}).get(module_id)
        if module is None:
            continue
        task = _from_json(row['task_json'], {})
        if isinstance(task, dict):
            module['tasks'].append(_compact_nones(_normalize_task(task)))

    cursor.execute(
        '''
        SELECT note_id, scope, client_id, content, created_at, updated_at, extra_json
        FROM project_api_notes
        ORDER BY created_at ASC, id ASC
        '''
    )
    for row in cursor.fetchall():
        note_payload = {
            'id': str(row['note_id']),
            'content': str(row['content'] or ''),
            'createdAt': int(row['created_at']) if row['created_at'] is not None else int(time.time() * 1000),
            'updatedAt': int(row['updated_at']) if row['updated_at'] is not None else None,
        }
        note_payload.update(_from_json(row['extra_json'], {}))
        note = _compact_nones(_normalize_note(note_payload))
        if str(row['scope']) == 'general':
            snapshot['generalNotes'].append(note)
            continue
        client_id = str(row['client_id'] or '')
        client = clients_by_id.get(client_id)
        if client is not None:
            client.setdefault('notes', []).append(note)

    return _normalize_snapshot(snapshot)


def _maybe_migrate_legacy_store(cursor: Any) -> None:
    migration_state = _get_project_api_migration_state(cursor)
    if migration_state is not None:
        return

    cursor.execute('SELECT COUNT(*) FROM project_api_snapshot_state')
    existing_rows = cursor.fetchone()[0]
    if existing_rows > 0:
        _mark_project_api_migration(cursor, 'skipped_existing_data')
        return

    if not os.path.exists(_STORE_FILE):
        _mark_project_api_migration(cursor, 'skipped_missing_json')
        return

    try:
        with open(_STORE_FILE, 'r', encoding='utf-8') as f:
            snapshot = _normalize_snapshot(json.load(f))
        _insert_snapshot_into_db(cursor, snapshot)
        _mark_project_api_migration(cursor, 'completed')
        logging.info('project_api legacy JSON migrated to DB successfully')
    except (OSError, json.JSONDecodeError, TypeError, ValueError) as exc:
        logging.exception('project_api migration failed: %s', exc)
        _mark_project_api_migration(cursor, f'failed:{type(exc).__name__}')


def _load_store() -> Dict[str, Any]:
    start = time.perf_counter()
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        _enable_foreign_keys_if_needed(cursor)
        _maybe_migrate_legacy_store(cursor)
        conn.commit()
        snapshot = _load_snapshot_from_db(cursor)
        return snapshot
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
        elapsed_ms = (time.perf_counter() - start) * 1000
        _record_metric('read_ops', 1)
        _record_metric('read_total_ms', elapsed_ms)


def _save_store(payload: Dict[str, Any]) -> None:
    start = time.perf_counter()
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        _enable_foreign_keys_if_needed(cursor)
        _insert_snapshot_into_db(cursor, payload)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
        elapsed_ms = (time.perf_counter() - start) * 1000
        _record_metric('write_ops', 1)
        _record_metric('write_total_ms', elapsed_ms)


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

    _record_metric('version_conflicts', 1)
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

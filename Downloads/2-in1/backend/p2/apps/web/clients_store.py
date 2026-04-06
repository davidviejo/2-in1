import json
import os
from threading import Lock
from typing import Any, Dict, List, Optional

_CLIENTS_CACHE: List[Dict[str, Any]] = []
_CLIENTS_MTIME: Optional[float] = None
_CLIENTS_LOCK = Lock()


def _clients_file_path() -> str:
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base_dir, '..', 'data', 'clients_db.json')


def get_clients_db() -> List[Dict[str, Any]]:
    global _CLIENTS_CACHE, _CLIENTS_MTIME
    file_path = _clients_file_path()

    try:
        current_mtime = os.path.getmtime(file_path)
    except FileNotFoundError:
        return []

    with _CLIENTS_LOCK:
        if _CLIENTS_MTIME == current_mtime and _CLIENTS_CACHE:
            return list(_CLIENTS_CACHE)

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                clients = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return []

        _CLIENTS_CACHE = clients
        _CLIENTS_MTIME = current_mtime
        return list(_CLIENTS_CACHE)


def get_safe_clients(include_private: bool = False) -> List[Dict[str, Any]]:
    clients = get_clients_db()
    if include_private:
        return clients

    return [
        {
            'slug': client.get('slug'),
            'name': client.get('name'),
            'status': client.get('status'),
            'description': client.get('description'),
        }
        for client in clients
    ]


def find_client_by_slug(slug: str) -> Optional[Dict[str, Any]]:
    return next((client for client in get_clients_db() if client.get('slug') == slug), None)

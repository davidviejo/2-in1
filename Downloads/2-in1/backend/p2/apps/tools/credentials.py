import os
from typing import Any, Dict, Optional

from flask import has_request_context, session

from apps.core.database import get_user_settings


MISSING_DFS_CREDENTIALS_MESSAGE = "Faltan credenciales de DataForSEO. Configúralas en Ajustes."


def resolve_dataforseo_credentials(override: Optional[Dict[str, Any]] = None, user_id: str = "default") -> Dict[str, str]:
    """
    Resuelve credenciales DataForSEO con prioridad:
    request override opcional > session > user_settings > env.
    """
    override = override or {}
    login_override = (override.get("login") or override.get("dataforseo_login") or override.get("dfs_login") or "").strip()
    pass_override = (
        override.get("password")
        or override.get("dataforseo_password")
        or override.get("dataforseo_pass")
        or override.get("dfs_pass")
        or ""
    ).strip()

    login = login_override
    password = pass_override

    if has_request_context():
        if not login:
            login = (session.get("dataforseo_login") or "").strip()
        if not password:
            password = (session.get("dataforseo_password") or session.get("dataforseo_pass") or "").strip()

    settings = get_user_settings(user_id) or {}
    if not login:
        login = (settings.get("dataforseo_login") or "").strip()
    if not password:
        password = (settings.get("dataforseo_password") or "").strip()

    if not login:
        login = (os.getenv("DATAFORSEO_LOGIN") or "").strip()
    if not password:
        password = (os.getenv("DATAFORSEO_PASSWORD") or "").strip()

    return {"login": login, "password": password}

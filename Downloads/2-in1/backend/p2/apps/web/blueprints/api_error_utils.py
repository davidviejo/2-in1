from __future__ import annotations

from typing import Any, Dict, Optional, Tuple

from flask import jsonify


def api_error(
    code: str,
    message: str,
    status_code: int = 400,
    detail: Optional[Any] = None,
) -> Tuple[Any, int]:
    """
    Build a standardized API error response.

    Contract:
    {
      "error": {
        "code": "machine_readable_code",
        "message": "human readable message",
        "detail": ... # optional, for diagnostics
      }
    }
    """
    payload: Dict[str, Any] = {
        "error": {
            "code": str(code),
            "message": str(message),
        }
    }
    if detail is not None:
        payload["error"]["detail"] = detail
    return jsonify(payload), status_code

import json
import uuid
import datetime
from typing import Any, Dict, List, Optional

from apps.core.database import get_db_connection


def _utc_now_iso() -> str:
    return datetime.datetime.utcnow().isoformat()


def create_project(name: str, description: str = "", project_id: Optional[str] = None) -> Dict[str, Any]:
    pid = str(project_id or uuid.uuid4())
    now = _utc_now_iso()

    conn = get_db_connection()
    c = conn.cursor()
    try:
        c.execute(
            '''
            INSERT INTO seo_tfidf_projects (id, name, description, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ''',
            (pid, str(name), str(description or ""), now, now),
        )
        conn.commit()
        return get_project_by_id(pid) or {}
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def list_projects(limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
    safe_limit = max(1, min(int(limit), 500))
    safe_offset = max(0, int(offset))

    conn = get_db_connection()
    try:
        c = conn.cursor()
        c.execute(
            '''
            SELECT *
            FROM seo_tfidf_projects
            ORDER BY created_at DESC, id DESC
            LIMIT ? OFFSET ?
            ''',
            (safe_limit, safe_offset),
        )
        rows = c.fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def get_project_by_id(project_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        c = conn.cursor()
        c.execute("SELECT * FROM seo_tfidf_projects WHERE id = ?", (str(project_id),))
        row = c.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def insert_documents(
    project_id: str,
    documents: List[Dict[str, Any]],
) -> int:
    if not documents:
        return 0

    conn = get_db_connection()
    c = conn.cursor()
    now = _utc_now_iso()

    values = []
    for doc in documents:
        doc_id = str(doc.get("id") or uuid.uuid4())
        values.append(
            (
                doc_id,
                str(project_id),
                str(doc.get("doc_key") or ""),
                str(doc.get("title") or ""),
                str(doc.get("url") or ""),
                str(doc.get("content") or ""),
                int(doc.get("token_count") or 0),
                json.dumps(doc.get("metadata") or {}),
                now,
                now,
            )
        )

    try:
        c.executemany(
            '''
            INSERT INTO seo_tfidf_documents (
                id, project_id, doc_key, title, url, content,
                token_count, metadata_json, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''',
            values,
        )
        conn.commit()
        return len(values)
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def create_run(
    project_id: str,
    params: Optional[Dict[str, Any]] = None,
    results: Optional[Dict[str, Any]] = None,
    terms: Optional[List[Dict[str, Any]]] = None,
    status: str = "completed",
    run_id: Optional[str] = None,
) -> Dict[str, Any]:
    rid = str(run_id or uuid.uuid4())
    now = _utc_now_iso()
    payload_params = json.dumps(params or {})
    payload_results = json.dumps(results or {})

    conn = get_db_connection()
    c = conn.cursor()

    try:
        c.execute(
            '''
            INSERT INTO seo_tfidf_runs (
                id, project_id, status, params_json, results_json,
                started_at, finished_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''',
            (rid, str(project_id), str(status), payload_params, payload_results, now, now, now),
        )

        if terms:
            term_rows = []
            for term in terms:
                term_rows.append(
                    (
                        rid,
                        str(project_id),
                        str(term.get("term") or ""),
                        float(term.get("tfidf") or 0.0),
                        int(term.get("doc_frequency") or 0),
                        int(term.get("document_count") or 0),
                        json.dumps(term.get("payload") or {}),
                        now,
                    )
                )

            c.executemany(
                '''
                INSERT INTO seo_tfidf_run_terms (
                    run_id, project_id, term, tfidf,
                    doc_frequency, document_count, payload_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''',
                term_rows,
            )

        conn.commit()
        return get_run_by_id(rid) or {}
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def get_run_by_id(run_id: str, include_terms: bool = True) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        c = conn.cursor()
        c.execute("SELECT * FROM seo_tfidf_runs WHERE id = ?", (str(run_id),))
        row = c.fetchone()
        if not row:
            return None

        run = dict(row)
        run["params_json"] = _safe_json_loads(run.get("params_json"), {})
        run["results_json"] = _safe_json_loads(run.get("results_json"), {})

        if include_terms:
            c.execute(
                '''
                SELECT term, tfidf, doc_frequency, document_count, payload_json
                FROM seo_tfidf_run_terms
                WHERE run_id = ?
                ORDER BY tfidf DESC, term ASC
                ''',
                (str(run_id),),
            )
            run["terms"] = [
                {
                    **dict(term_row),
                    "payload_json": _safe_json_loads(dict(term_row).get("payload_json"), {}),
                }
                for term_row in c.fetchall()
            ]

        return run
    finally:
        conn.close()


def list_runs_by_project(project_id: str, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
    safe_limit = max(1, min(int(limit), 200))
    safe_offset = max(0, int(offset))

    conn = get_db_connection()
    try:
        c = conn.cursor()
        c.execute(
            '''
            SELECT *
            FROM seo_tfidf_runs
            WHERE project_id = ?
            ORDER BY created_at DESC, id DESC
            LIMIT ? OFFSET ?
            ''',
            (str(project_id), safe_limit, safe_offset),
        )

        runs = []
        for row in c.fetchall():
            run = dict(row)
            run["params_json"] = _safe_json_loads(run.get("params_json"), {})
            run["results_json"] = _safe_json_loads(run.get("results_json"), {})
            runs.append(run)
        return runs
    finally:
        conn.close()


def _safe_json_loads(value: Any, default: Any) -> Any:
    if not isinstance(value, str):
        return value if value is not None else default

    try:
        return json.loads(value)
    except Exception:
        return default

"""
Database Management Module

This module handles the database connection (SQLite or PostgreSQL), initialization,
and CRUD operations for projects and clusters. It supports migration from a JSON
file if the database is empty.
"""
import sqlite3
import json
import os
import logging
import functools
import base64
import uuid
import datetime
import re
from typing import List, Dict, Optional, Any
from urllib.parse import urlparse
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from cryptography.fernet import Fernet, InvalidToken

# Database Configuration
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_FILE = os.path.join(BASE_DIR, '..', 'data', 'projects.db')
JSON_SOURCE_FILE = os.path.join(BASE_DIR, '..', 'data', 'projects_db.json')

# Check environment variable for database URL
DATABASE_URL = os.environ.get('DATABASE_URL')
USE_POSTGRES = False
if DATABASE_URL and DATABASE_URL.startswith("postgres"):
    USE_POSTGRES = True
    try:
        import psycopg2
        import psycopg2.extras
    except ImportError:
        logging.warning("psycopg2 not installed. PostgreSQL support disabled.")
        USE_POSTGRES = False

DB_SCHEMA_MIGRATION_ERRORS = (sqlite3.OperationalError,)
if USE_POSTGRES:
    DB_SCHEMA_MIGRATION_ERRORS = DB_SCHEMA_MIGRATION_ERRORS + (psycopg2.Error,)


SENSITIVE_USER_SETTINGS_COLUMNS = {
    'openai_key',
    'anthropic_key',
    'dataforseo_password',
    'serpapi_key',
    'google_cse_key',
}
ENCRYPTED_VALUE_PREFIX = 'enc:v1:'


def _get_settings_encryption_key() -> str:
    key = os.environ.get('SETTINGS_ENCRYPTION_KEY')
    if not key:
        raise RuntimeError('SETTINGS_ENCRYPTION_KEY is required to read/write user settings secrets')
    return key


@functools.lru_cache(maxsize=1)
def _get_settings_cipher() -> Fernet:
    raw_key = _get_settings_encryption_key().encode('utf-8')

    try:
        return Fernet(raw_key)
    except Exception:
        # Backward-compatible convenience: derive a valid Fernet key from arbitrary input.
        derived_key = base64.urlsafe_b64encode(raw_key.ljust(32, b'0')[:32])
        return Fernet(derived_key)


def _encrypt_sensitive_setting(column: str, value: Any) -> Any:
    if column not in SENSITIVE_USER_SETTINGS_COLUMNS or value in (None, ''):
        return value

    value_str = str(value)
    if value_str.startswith(ENCRYPTED_VALUE_PREFIX):
        return value_str

    token = _get_settings_cipher().encrypt(value_str.encode('utf-8')).decode('utf-8')
    return f"{ENCRYPTED_VALUE_PREFIX}{token}"


def _decrypt_sensitive_setting(column: str, value: Any) -> Any:
    if column not in SENSITIVE_USER_SETTINGS_COLUMNS or value in (None, ''):
        return value

    value_str = str(value)
    if not value_str.startswith(ENCRYPTED_VALUE_PREFIX):
        return value_str

    token = value_str[len(ENCRYPTED_VALUE_PREFIX):]
    try:
        return _get_settings_cipher().decrypt(token.encode('utf-8')).decode('utf-8')
    except (InvalidToken, ValueError):
        logging.warning("Unable to decrypt user_settings.%s; returning original stored value", column)
        return value_str


def _migrate_user_settings_sensitive_data(conn) -> None:
    c = conn.cursor()
    columns = sorted(SENSITIVE_USER_SETTINGS_COLUMNS)
    c.execute(f"SELECT user_id, {', '.join(columns)} FROM user_settings")
    rows = c.fetchall()

    for row in rows:
        row_map = dict(row)
        updates = {}

        for column in columns:
            raw_value = row_map.get(column)
            if raw_value in (None, ''):
                continue
            if str(raw_value).startswith(ENCRYPTED_VALUE_PREFIX):
                continue
            updates[column] = _encrypt_sensitive_setting(column, raw_value)

        if not updates:
            continue

        set_clause = ', '.join(f"{column}=?" for column in updates)
        params = list(updates.values()) + [row_map['user_id']]
        c.execute(f"UPDATE user_settings SET {set_clause} WHERE user_id=?", params)


class PostgresCursorWrapper:
    """
    Wraps psycopg2 cursor to mimic sqlite3 cursor behavior.
    """
    def __init__(self, cursor):
        self.cursor = cursor

    def _replace_placeholders(self, query):
        """
        Replaces '?' with '%s' but ignores '?' inside single quotes.
        This is a basic implementation and might not handle escaped quotes perfectly.
        """
        def replace(match):
            # If it's a quoted string, return it as is
            if match.group(1):
                return match.group(1)
            # If it's a question mark, replace with %s
            return "%s"

        # Regex: match single quoted string OR a question mark
        # Group 1 captures the quoted string
        pattern = r"('[^']*')|(\?)"
        return re.sub(pattern, replace, query)

    def execute(self, query, params=None):
        query = self._replace_placeholders(query)
        return self.cursor.execute(query, params)

    def executemany(self, query, params_list):
        query = self._replace_placeholders(query)
        return self.cursor.executemany(query, params_list)

    def fetchone(self):
        return self.cursor.fetchone()

    def fetchall(self):
        return self.cursor.fetchall()

    def __getattr__(self, name):
        return getattr(self.cursor, name)


class PostgresConnectionWrapper:
    """
    Wraps psycopg2 connection to mimic sqlite3 connection behavior.
    """
    def __init__(self, conn):
        self.conn = conn

    def cursor(self):
        return PostgresCursorWrapper(self.conn.cursor(cursor_factory=psycopg2.extras.DictCursor))

    def commit(self):
        return self.conn.commit()

    def rollback(self):
        return self.conn.rollback()

    def close(self):
        return self.conn.close()


def get_db_connection():
    """
    Establishes a connection to the database (SQLite or Postgres).
    """
    if USE_POSTGRES:
        try:
            conn = psycopg2.connect(DATABASE_URL)
            return PostgresConnectionWrapper(conn)
        except Exception as e:
            logging.error(f"PostgreSQL connection failed: {e}")
            # Fallback not implemented to prevent data inconsistency
            raise e
    else:
        conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
        return conn


def init_db() -> None:
    """
    Initialize the database tables (projects and clusters) if they do not
    exist.
    Also triggers migration from JSON if the database is empty.
    """
    conn = get_db_connection()
    c = conn.cursor()

    # Enable foreign keys (only needed for SQLite)
    if not USE_POSTGRES:
        c.execute("PRAGMA foreign_keys = ON;")

    # Define types based on DB
    # Fix: SERIAL implies integer and autoincrement, but explicit PRIMARY KEY is needed in standard SQL/Postgres for clarity and constraint
    auto_inc_type = "SERIAL PRIMARY KEY" if USE_POSTGRES else "INTEGER PRIMARY KEY AUTOINCREMENT"
    text_pk = "TEXT PRIMARY KEY"

    # Projects Table
    c.execute(f'''
        CREATE TABLE IF NOT EXISTS projects (
            id {text_pk},
            name TEXT NOT NULL,
            domain TEXT,
            geo TEXT,
            competitors TEXT,
            brand_name TEXT,
            sitemap_url TEXT,
            business_type TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # User Settings Table
    c.execute(f'''
        CREATE TABLE IF NOT EXISTS user_settings (
            user_id {text_pk},
            default_model TEXT,
            privacy_mode INTEGER DEFAULT 0,
            openai_key TEXT,
            anthropic_key TEXT,
            dataforseo_login TEXT,
            dataforseo_password TEXT,
            dataforseo_detail TEXT DEFAULT 'regular',
            dataforseo_execution_mode TEXT DEFAULT 'standard',
            serpapi_key TEXT,
            serp_provider TEXT DEFAULT 'dataforseo',
            google_cse_key TEXT,
            google_cse_cx TEXT,
            scraping_cookie TEXT,
            memory_limit INTEGER DEFAULT 4096,
            system_prompt TEXT
        )
    ''')

    # Clusters Table
    c.execute(f'''
        CREATE TABLE IF NOT EXISTS clusters (
            id {auto_inc_type},
            project_id TEXT NOT NULL,
            name TEXT,
            url TEXT,
            target_kw TEXT,
            FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
        )
    ''')

    # Analysis Jobs Table
    c.execute(f'''
        CREATE TABLE IF NOT EXISTS analysis_jobs (
            job_id {text_pk},
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'queued',
            total_urls INTEGER DEFAULT 0,
            processed_urls INTEGER DEFAULT 0,
            success_count INTEGER DEFAULT 0,
            error_count INTEGER DEFAULT 0,
            analysis_config TEXT,
            user_notes TEXT,
            last_error TEXT,
            advanced_allowed INTEGER DEFAULT 0,
            advanced_blocked_reason TEXT
        )
    ''')

    # Analysis Job Items Table
    c.execute(f'''
        CREATE TABLE IF NOT EXISTS analysis_job_items (
            item_id {text_pk},
            job_id TEXT NOT NULL,
            url TEXT NOT NULL,
            page_id TEXT,
            status TEXT DEFAULT 'queued',
            started_at TIMESTAMP,
            finished_at TIMESTAMP,
            result_json TEXT,
            error_message TEXT,
            item_metadata TEXT,
            FOREIGN KEY (job_id) REFERENCES analysis_jobs (job_id) ON DELETE CASCADE
        )
    ''')

    # AI Visibility Config Table
    c.execute(f'''
        CREATE TABLE IF NOT EXISTS ai_visibility_configs (
            client_id {text_pk},
            brand TEXT NOT NULL,
            competitors TEXT,
            prompt_template TEXT,
            sources TEXT,
            provider_priority TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # AI Visibility Runs Table
    c.execute(f'''
        CREATE TABLE IF NOT EXISTS ai_visibility_runs (
            id {auto_inc_type},
            client_id TEXT NOT NULL,
            run_version INTEGER DEFAULT 1,
            run_trigger TEXT DEFAULT 'manual',
            request_payload TEXT,
            mentions REAL DEFAULT 0,
            share_of_voice REAL DEFAULT 0,
            sentiment REAL DEFAULT 0,
            competitor_appearances TEXT,
            raw_evidence TEXT,
            provider_used TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # AI Visibility Schedule Table
    c.execute(f'''
        CREATE TABLE IF NOT EXISTS ai_visibility_schedules (
            client_id {text_pk},
            frequency TEXT NOT NULL DEFAULT 'daily',
            timezone TEXT NOT NULL DEFAULT 'UTC',
            run_hour INTEGER NOT NULL DEFAULT 9,
            run_minute INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'paused',
            last_run_at TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # AI Visibility Execution Logs Table
    c.execute(f'''
        CREATE TABLE IF NOT EXISTS ai_visibility_execution_logs (
            id {auto_inc_type},
            client_id TEXT NOT NULL,
            run_id INTEGER,
            status TEXT NOT NULL,
            error_type TEXT,
            error_message TEXT,
            recoverable INTEGER DEFAULT 0,
            details_json TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # SEO TF-IDF Projects Table
    c.execute(f'''
        CREATE TABLE IF NOT EXISTS seo_tfidf_projects (
            id {text_pk},
            name TEXT NOT NULL,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # SEO TF-IDF Documents Table
    c.execute(f'''
        CREATE TABLE IF NOT EXISTS seo_tfidf_documents (
            id {text_pk},
            project_id TEXT NOT NULL,
            doc_key TEXT,
            title TEXT,
            url TEXT,
            content TEXT,
            token_count INTEGER DEFAULT 0,
            metadata_json TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES seo_tfidf_projects (id) ON DELETE CASCADE
        )
    ''')

    # SEO TF-IDF Runs Table
    c.execute(f'''
        CREATE TABLE IF NOT EXISTS seo_tfidf_runs (
            id {text_pk},
            project_id TEXT NOT NULL,
            status TEXT DEFAULT 'completed',
            params_json TEXT,
            results_json TEXT,
            started_at TIMESTAMP,
            finished_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES seo_tfidf_projects (id) ON DELETE CASCADE
        )
    ''')

    # SEO TF-IDF Run Terms Table (optional for efficient querying)
    c.execute(f'''
        CREATE TABLE IF NOT EXISTS seo_tfidf_run_terms (
            id {auto_inc_type},
            run_id TEXT NOT NULL,
            project_id TEXT NOT NULL,
            term TEXT NOT NULL,
            tfidf REAL NOT NULL,
            doc_frequency INTEGER,
            document_count INTEGER,
            payload_json TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (run_id) REFERENCES seo_tfidf_runs (id) ON DELETE CASCADE,
            FOREIGN KEY (project_id) REFERENCES seo_tfidf_projects (id) ON DELETE CASCADE
        )
    ''')

    # Project API Snapshot State Table (single row storage)
    c.execute(f'''
        CREATE TABLE IF NOT EXISTS project_api_snapshot_state (
            id INTEGER PRIMARY KEY,
            version INTEGER NOT NULL DEFAULT 1,
            updated_at BIGINT NOT NULL,
            current_client_id TEXT,
            last_mutation_json TEXT
        )
    ''')

    # Project API Clients Table
    c.execute(f'''
        CREATE TABLE IF NOT EXISTS project_api_clients (
            id {text_pk},
            name TEXT NOT NULL,
            vertical TEXT,
            created_at BIGINT,
            completed_tasks_log_json TEXT,
            custom_roadmap_order_json TEXT,
            ai_roadmap_json TEXT,
            kanban_columns_json TEXT,
            ia_visibility_json TEXT
        )
    ''')

    # Project API Modules Table
    c.execute(f'''
        CREATE TABLE IF NOT EXISTS project_api_modules (
            id {auto_inc_type},
            client_id TEXT NOT NULL,
            module_id INTEGER NOT NULL,
            title TEXT,
            subtitle TEXT,
            level_range TEXT,
            description TEXT,
            icon_name TEXT,
            is_custom INTEGER,
            UNIQUE (client_id, module_id),
            FOREIGN KEY (client_id) REFERENCES project_api_clients (id) ON DELETE CASCADE
        )
    ''')

    # Project API Tasks Table
    c.execute(f'''
        CREATE TABLE IF NOT EXISTS project_api_tasks (
            id {auto_inc_type},
            client_id TEXT NOT NULL,
            module_id INTEGER NOT NULL,
            task_id TEXT NOT NULL,
            task_json TEXT NOT NULL,
            UNIQUE (client_id, module_id, task_id),
            FOREIGN KEY (client_id) REFERENCES project_api_clients (id) ON DELETE CASCADE
        )
    ''')

    # Project API Notes Table
    c.execute(f'''
        CREATE TABLE IF NOT EXISTS project_api_notes (
            id {auto_inc_type},
            note_id TEXT NOT NULL,
            scope TEXT NOT NULL,
            client_id TEXT,
            content TEXT,
            created_at BIGINT,
            updated_at BIGINT,
            extra_json TEXT,
            UNIQUE (note_id, scope, client_id)
        )
    ''')

    # Project API Migration/Metadata Table
    c.execute(f'''
        CREATE TABLE IF NOT EXISTS project_api_meta (
            key {text_pk},
            value TEXT
        )
    ''')

    # Check if item_metadata column exists (for migration of existing table)
    # This logic is slightly more complex with Postgres, keeping it simple for now
    try:
        c.execute("SELECT item_metadata FROM analysis_job_items LIMIT 1")
    except DB_SCHEMA_MIGRATION_ERRORS:
        try:
            if USE_POSTGRES:
                conn.rollback()
            c.execute("ALTER TABLE analysis_job_items ADD COLUMN item_metadata TEXT")
            conn.commit()
        except DB_SCHEMA_MIGRATION_ERRORS as e:
            logging.error(f"Error adding item_metadata column: {e}")
            if USE_POSTGRES:
                conn.rollback()

    # Migration guards for ai_visibility_runs columns.
    for query in (
        "ALTER TABLE ai_visibility_runs ADD COLUMN run_version INTEGER DEFAULT 1",
        "ALTER TABLE ai_visibility_runs ADD COLUMN run_trigger TEXT DEFAULT 'manual'",
    ):
        try:
            c.execute(query)
            conn.commit()
        except DB_SCHEMA_MIGRATION_ERRORS:
            if USE_POSTGRES:
                conn.rollback()

    # Migration guards for user_settings SERP columns.
    for query in (
        "ALTER TABLE user_settings ADD COLUMN serp_provider TEXT DEFAULT 'dataforseo'",
        "ALTER TABLE user_settings ADD COLUMN google_cse_key TEXT",
        "ALTER TABLE user_settings ADD COLUMN google_cse_cx TEXT",
        "ALTER TABLE user_settings ADD COLUMN scraping_cookie TEXT",
        "ALTER TABLE user_settings ADD COLUMN dataforseo_detail TEXT DEFAULT 'regular'",
        "ALTER TABLE user_settings ADD COLUMN dataforseo_execution_mode TEXT DEFAULT 'standard'",
    ):
        try:
            c.execute(query)
            conn.commit()
        except DB_SCHEMA_MIGRATION_ERRORS:
            if USE_POSTGRES:
                conn.rollback()

    try:
        _migrate_user_settings_sensitive_data(conn)
    except Exception as e:
        logging.error(f"Error migrating encrypted user settings: {e}")
        if USE_POSTGRES:
            conn.rollback()

    conn.commit()
    conn.close()

    # Check for migration
    migrate_from_json()


def migrate_from_json() -> None:
    """
    Migrate data from projects_db.json to SQLite/PG if the database is empty
    and the JSON source file exists.
    """
    if not os.path.exists(JSON_SOURCE_FILE):
        return

    conn = get_db_connection()
    c = conn.cursor()

    # Check if DB is empty
    c.execute("SELECT COUNT(*) FROM projects")
    if c.fetchone()[0] > 0:
        conn.close()
        return

    try:
        with open(JSON_SOURCE_FILE, 'r', encoding='utf-8') as f:
            projects = json.load(f)

        projects_data = []
        clusters_data = []

        for p in projects:
            # Prepare Project Data
            projects_data.append((
                str(p.get('id')),
                p.get('name', ''),
                p.get('domain', ''),
                p.get('geo', ''),
                p.get('competitors', ''),
                p.get('brand_name', ''),
                p.get('sitemap_url', ''),
                p.get('business_type', 'blog')
            ))

            # Prepare Clusters Data
            clusters = p.get('clusters', [])
            for cluster in clusters:
                clusters_data.append((
                    str(p.get('id')),
                    cluster.get('name', ''),
                    cluster.get('url', ''),
                    cluster.get('target_kw', '')
                ))

        # Bulk Insert Projects
        c.executemany('''
            INSERT INTO projects (
                id, name, domain, geo, competitors,
                brand_name, sitemap_url, business_type
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', projects_data)

        # Bulk Insert Clusters
        c.executemany('''
            INSERT INTO clusters (project_id, name, url, target_kw)
            VALUES (?, ?, ?, ?)
        ''', clusters_data)

        conn.commit()

    except Exception as e:
        logging.error(f"Migration failed: {e}")
        conn.rollback()
    finally:
        conn.close()


# --- CRUD Operations ---

@functools.lru_cache(maxsize=128)
def get_user_settings(user_id: str = 'default') -> Dict[str, Any]:
    """
    Retrieve user settings by ID.
    Returns default empty dict if not found.
    """
    conn = get_db_connection()
    try:
        c = conn.cursor()
        c.execute("SELECT * FROM user_settings WHERE user_id = ?", (str(user_id),))
        row = c.fetchone()
        if not row:
            return {}

        payload = dict(row)
        for key in SENSITIVE_USER_SETTINGS_COLUMNS:
            payload[key] = _decrypt_sensitive_setting(key, payload.get(key))
        return payload
    finally:
        conn.close()

def upsert_user_settings(user_id: str, data: Dict[str, Any]) -> None:
    """
    Insert or update user settings.
    """
    conn = get_db_connection()
    c = conn.cursor()
    try:
        # Check if exists
        c.execute("SELECT 1 FROM user_settings WHERE user_id = ?", (str(user_id),))
        exists = c.fetchone()

        # Filter only valid columns to avoid SQL injection or errors
        valid_columns = [
            'default_model', 'privacy_mode', 'openai_key', 'anthropic_key',
            'dataforseo_login', 'dataforseo_password', 'dataforseo_detail', 'dataforseo_execution_mode', 'serpapi_key',
            'serp_provider', 'google_cse_key', 'google_cse_cx', 'scraping_cookie',
            'memory_limit', 'system_prompt'
        ]

        # Build dynamic query
        update_fields = []
        update_values = []

        insert_fields = ['user_id']
        insert_values = [str(user_id)]

        for key in valid_columns:
            if key in data:
                update_fields.append(f"{key}=?")
                encrypted_value = _encrypt_sensitive_setting(key, data[key])
                update_values.append(encrypted_value)

                insert_fields.append(key)
                insert_values.append(encrypted_value)

        if not update_fields:
            return # Nothing to update

        if exists:
            update_values.append(str(user_id))
            query = f"UPDATE user_settings SET {', '.join(update_fields)} WHERE user_id=?"
            c.execute(query, update_values)
        else:
            placeholders = ', '.join(['?'] * len(insert_values))
            query = f"INSERT INTO user_settings ({', '.join(insert_fields)}) VALUES ({placeholders})"
            c.execute(query, insert_values)

        conn.commit()
        # Invalidate cache
        get_user_settings.cache_clear()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


def upsert_ai_visibility_config(client_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Create or update recurrent AI visibility config for one client."""
    conn = get_db_connection()
    c = conn.cursor()
    now_utc = datetime.datetime.utcnow().isoformat()

    payload = {
        'client_id': str(client_id),
        'brand': str(data.get('brand') or ''),
        'competitors': json.dumps(data.get('competitors') or []),
        'prompt_template': str(data.get('promptTemplate') or ''),
        'sources': json.dumps(data.get('sources') or []),
        'provider_priority': json.dumps(data.get('providerPriority') or ['gemini', 'openai']),
        'updated_at': now_utc,
    }

    try:
        c.execute("SELECT 1 FROM ai_visibility_configs WHERE client_id = ?", (payload['client_id'],))
        exists = c.fetchone()

        if exists:
            c.execute(
                '''
                UPDATE ai_visibility_configs
                SET brand=?, competitors=?, prompt_template=?, sources=?, provider_priority=?, updated_at=?
                WHERE client_id=?
                ''',
                (
                    payload['brand'],
                    payload['competitors'],
                    payload['prompt_template'],
                    payload['sources'],
                    payload['provider_priority'],
                    payload['updated_at'],
                    payload['client_id'],
                )
            )
        else:
            c.execute(
                '''
                INSERT INTO ai_visibility_configs (
                    client_id, brand, competitors, prompt_template, sources, provider_priority, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                ''',
                (
                    payload['client_id'],
                    payload['brand'],
                    payload['competitors'],
                    payload['prompt_template'],
                    payload['sources'],
                    payload['provider_priority'],
                    payload['updated_at'],
                )
            )

        conn.commit()
        return get_ai_visibility_config(payload['client_id'])
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


def get_ai_visibility_config(client_id: str) -> Dict[str, Any]:
    """Get recurrent AI visibility config by client_id."""
    conn = get_db_connection()
    try:
        c = conn.cursor()
        c.execute("SELECT * FROM ai_visibility_configs WHERE client_id = ?", (str(client_id),))
        row = c.fetchone()
        if not row:
            return {}

        config = dict(row)
        for key in ('competitors', 'sources', 'provider_priority'):
            raw = config.get(key)
            if isinstance(raw, str):
                try:
                    config[key] = json.loads(raw)
                except (json.JSONDecodeError, TypeError, ValueError):
                    config[key] = []
        return config
    finally:
        conn.close()


def insert_ai_visibility_run(client_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Persist one AI visibility execution result."""
    conn = get_db_connection()
    c = conn.cursor()

    try:
        c.execute("SELECT MAX(run_version) FROM ai_visibility_runs WHERE client_id = ?", (str(client_id),))
        current_version = c.fetchone()
        next_version = int((current_version[0] if current_version else 0) or 0) + 1

        c.execute(
            '''
            INSERT INTO ai_visibility_runs (
                client_id, run_version, run_trigger, request_payload, mentions, share_of_voice, sentiment,
                competitor_appearances, raw_evidence, provider_used
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''',
            (
                str(client_id),
                next_version,
                str(data.get('runTrigger') or 'manual'),
                json.dumps(data.get('requestPayload') or {}),
                float(data.get('mentions') or 0),
                float(data.get('shareOfVoice') or 0),
                float(data.get('sentiment') or 0),
                json.dumps(data.get('competitorAppearances') or {}),
                json.dumps(data.get('rawEvidence') or []),
                str(data.get('providerUsed') or ''),
            )
        )
        run_id = c.lastrowid
        conn.commit()
        c.execute("SELECT * FROM ai_visibility_runs WHERE id = ?", (run_id,))
        row = c.fetchone()
        return _normalize_ai_visibility_row(dict(row)) if row else {}
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


def get_ai_visibility_history(client_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    """Fetch latest AI visibility runs for one client."""
    safe_limit = max(1, min(int(limit), 100))
    conn = get_db_connection()
    try:
        c = conn.cursor()
        c.execute(
            '''
            SELECT * FROM ai_visibility_runs
            WHERE client_id = ?
            ORDER BY created_at DESC, id DESC
            LIMIT ?
            ''',
            (str(client_id), safe_limit)
        )
        rows = c.fetchall()
        return [_normalize_ai_visibility_row(dict(row)) for row in rows]
    finally:
        conn.close()


def _normalize_ai_visibility_row(row: Dict[str, Any]) -> Dict[str, Any]:
    for key in ('request_payload', 'competitor_appearances', 'raw_evidence'):
        raw = row.get(key)
        if isinstance(raw, str):
            try:
                row[key] = json.loads(raw)
            except (json.JSONDecodeError, TypeError, ValueError):
                row[key] = {} if key != 'raw_evidence' else []
    return row


def upsert_ai_visibility_schedule(client_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    conn = get_db_connection()
    c = conn.cursor()
    now_utc = datetime.datetime.utcnow().isoformat()
    existing = get_ai_visibility_schedule(client_id) or {}

    frequency = str(data.get('frequency') or existing.get('frequency') or 'daily').lower()
    if frequency not in ('daily', 'weekly'):
        frequency = 'daily'

    timezone = str(data.get('timezone') or existing.get('timezone') or 'UTC')
    try:
        ZoneInfo(timezone)
    except ZoneInfoNotFoundError:
        timezone = 'UTC'

    run_hour = max(0, min(int(data.get('runHour', existing.get('run_hour', 9))), 23))
    run_minute = max(0, min(int(data.get('runMinute', existing.get('run_minute', 0))), 59))
    status = str(data.get('status') or existing.get('status') or 'paused').lower()
    if status not in ('active', 'paused'):
        status = 'paused'

    try:
        c.execute("SELECT 1 FROM ai_visibility_schedules WHERE client_id = ?", (str(client_id),))
        exists = c.fetchone()
        if exists:
            c.execute(
                '''
                UPDATE ai_visibility_schedules
                SET frequency=?, timezone=?, run_hour=?, run_minute=?, status=?, updated_at=?
                WHERE client_id=?
                ''',
                (frequency, timezone, run_hour, run_minute, status, now_utc, str(client_id))
            )
        else:
            c.execute(
                '''
                INSERT INTO ai_visibility_schedules (
                    client_id, frequency, timezone, run_hour, run_minute, status, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                ''',
                (str(client_id), frequency, timezone, run_hour, run_minute, status, now_utc)
            )
        conn.commit()
        return get_ai_visibility_schedule(client_id)
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


def get_ai_visibility_schedule(client_id: str) -> Dict[str, Any]:
    conn = get_db_connection()
    try:
        c = conn.cursor()
        c.execute("SELECT * FROM ai_visibility_schedules WHERE client_id = ?", (str(client_id),))
        row = c.fetchone()
        return dict(row) if row else {}
    finally:
        conn.close()


def get_active_ai_visibility_schedules() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        c = conn.cursor()
        c.execute("SELECT * FROM ai_visibility_schedules WHERE status='active'")
        return [dict(row) for row in c.fetchall()]
    finally:
        conn.close()


def mark_ai_visibility_schedule_run(client_id: str, run_at: Optional[str] = None) -> None:
    conn = get_db_connection()
    try:
        c = conn.cursor()
        run_at = run_at or datetime.datetime.utcnow().isoformat()
        c.execute(
            '''
            UPDATE ai_visibility_schedules
            SET last_run_at=?, updated_at=?
            WHERE client_id=?
            ''',
            (run_at, run_at, str(client_id))
        )
        conn.commit()
    finally:
        conn.close()


def insert_ai_visibility_execution_log(client_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    conn = get_db_connection()
    c = conn.cursor()
    try:
        c.execute(
            '''
            INSERT INTO ai_visibility_execution_logs (
                client_id, run_id, status, error_type, error_message, recoverable, details_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ''',
            (
                str(client_id),
                data.get('runId'),
                str(data.get('status') or 'error'),
                str(data.get('errorType') or ''),
                str(data.get('errorMessage') or ''),
                1 if bool(data.get('recoverable')) else 0,
                json.dumps(data.get('details') or {}),
            )
        )
        log_id = c.lastrowid
        conn.commit()
        c.execute("SELECT * FROM ai_visibility_execution_logs WHERE id = ?", (log_id,))
        row = c.fetchone()
        return dict(row) if row else {}
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


def get_all_projects() -> List[Dict[str, Any]]:
    """
    Retrieve all projects with their clusters.

    Returns:
        List[Dict[str, Any]]: A list of project dictionaries, each
                              containing a 'clusters' list.
    """
    conn = get_db_connection()
    try:
        c = conn.cursor()

        # Get all projects
        c.execute("SELECT * FROM projects")
        projects_rows = c.fetchall()

        # Get all clusters in a single query to avoid N+1 problem
        c.execute("SELECT project_id, name, url, target_kw FROM clusters")
        all_clusters_rows = c.fetchall()

        # Group clusters by project_id
        clusters_map = {}
        for row in all_clusters_rows:
            cluster = dict(row)
            p_id = cluster.pop('project_id')  # Remove project_id from the dict
            if p_id not in clusters_map:
                clusters_map[p_id] = []
            clusters_map[p_id].append(cluster)

        projects = []
        for p_row in projects_rows:
            p_dict = dict(p_row)
            # Assign clusters efficiently
            p_dict['clusters'] = clusters_map.get(p_dict['id'], [])
            projects.append(p_dict)

        return projects
    finally:
        conn.close()


def get_project(project_id: str) -> Optional[Dict[str, Any]]:
    """
    Retrieve a single project by ID.

    Args:
        project_id (str): The ID of the project to retrieve.

    Returns:
        Optional[Dict[str, Any]]: The project dictionary with clusters,
                                  or None if not found.
    """
    if not project_id:
        return None

    conn = get_db_connection()
    try:
        c = conn.cursor()

        c.execute("SELECT * FROM projects WHERE id = ?", (str(project_id),))
        p_row = c.fetchone()

        if not p_row:
            return None

        p_dict = dict(p_row)

        c.execute(
            "SELECT name, url, target_kw FROM clusters WHERE project_id = ?",
            (str(project_id),)
        )
        clusters_rows = c.fetchall()
        p_dict['clusters'] = [dict(cluster) for cluster in clusters_rows]

        return p_dict
    finally:
        conn.close()


def bulk_insert_projects(projects_data: List[Dict[str, Any]]) -> None:
    """
    Bulk insert projects and their clusters in a single transaction.

    This function is optimized for bulk imports where many projects are added at once.
    It expects that the projects are new (e.g. after a reset).

    Args:
        projects_data (List[Dict[str, Any]]): A list of project dictionaries.
    """
    if not projects_data:
        return

    conn = get_db_connection()
    c = conn.cursor()

    try:
        # Prepare data for bulk insert
        projects_tuples = []
        clusters_tuples = []

        for p in projects_data:
            p_id = str(p['id'])
            projects_tuples.append((
                p_id,
                p.get('name'),
                p.get('domain'),
                p.get('geo'),
                p.get('competitors'),
                p.get('brand_name'),
                p.get('sitemap_url'),
                p.get('business_type')
            ))

            if 'clusters' in p:
                for cluster in p['clusters']:
                    clusters_tuples.append((
                        p_id,
                        cluster.get('name', ''),
                        cluster.get('url', ''),
                        cluster.get('target_kw', '')
                    ))

        c.executemany('''
            INSERT INTO projects (
                id, name, domain, geo, competitors,
                brand_name, sitemap_url, business_type
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', projects_tuples)

        if clusters_tuples:
            c.executemany('''
                INSERT INTO clusters (project_id, name, url, target_kw)
                VALUES (?, ?, ?, ?)
            ''', clusters_tuples)

        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


def upsert_project(data: Dict[str, Any]) -> None:
    """
    Insert a new project or update an existing one.

    Args:
        data (Dict[str, Any]): A dictionary containing project fields.
                               Must include 'id'.
    """
    conn = get_db_connection()
    c = conn.cursor()

    try:
        # Check if exists
        c.execute("SELECT 1 FROM projects WHERE id = ?", (str(data['id']),))
        exists = c.fetchone()

        if exists:
            c.execute('''
                UPDATE projects
                SET name=?, domain=?, geo=?, competitors=?,
                    brand_name=?, sitemap_url=?, business_type=?
                WHERE id=?
            ''', (
                data.get('name'),
                data.get('domain'),
                data.get('geo'),
                data.get('competitors'),
                data.get('brand_name'),
                data.get('sitemap_url'),
                data.get('business_type'),
                str(data['id'])
            ))
        else:
            c.execute('''
                INSERT INTO projects (
                    id, name, domain, geo, competitors,
                    brand_name, sitemap_url, business_type
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                str(data['id']),
                data.get('name'),
                data.get('domain'),
                data.get('geo'),
                data.get('competitors'),
                data.get('brand_name'),
                data.get('sitemap_url'),
                data.get('business_type')
            ))

        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


def replace_clusters(project_id: str, clusters: List[Dict[str, str]]) -> None:
    """
    Replace all clusters for a specific project.

    Args:
        project_id (str): The ID of the project.
        clusters (List[Dict[str, str]]): A list of cluster dictionaries.
    """
    if clusters is None:
        clusters = []

    conn = get_db_connection()
    c = conn.cursor()

    try:
        # Delete existing clusters
        c.execute(
            "DELETE FROM clusters WHERE project_id = ?", (str(project_id),)
        )

        # Insert new clusters
        cluster_data = [
            (
                str(project_id),
                cluster.get('name', ''),
                cluster.get('url', ''),
                cluster.get('target_kw', '')
            )
            for cluster in clusters
        ]

        c.executemany('''
            INSERT INTO clusters (project_id, name, url, target_kw)
            VALUES (?, ?, ?, ?)
        ''', cluster_data)

        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


def delete_project(project_id: str) -> None:
    """
    Delete a project and its associated clusters.

    Args:
        project_id (str): The ID of the project to delete.
    """
    conn = get_db_connection()
    c = conn.cursor()

    if not USE_POSTGRES:
        c.execute("PRAGMA foreign_keys = ON;")

    try:
        c.execute("DELETE FROM projects WHERE id = ?", (str(project_id),))
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


def reset_all_projects() -> None:
    """
    Delete all projects from the database.
    """
    conn = get_db_connection()
    c = conn.cursor()
    if not USE_POSTGRES:
        c.execute("PRAGMA foreign_keys = ON;")
    try:
        c.execute("DELETE FROM projects")
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


# --- Jobs Operations ---

def create_job(job_data: Dict[str, Any], items_data: List[Dict[str, Any]]) -> str:
    """
    Creates a new analysis job and its items.
    """
    conn = get_db_connection()
    c = conn.cursor()
    job_id = str(uuid.uuid4())

    try:
        # Insert Job
        c.execute('''
            INSERT INTO analysis_jobs (
                job_id, status, total_urls, analysis_config,
                user_notes, advanced_allowed, advanced_blocked_reason
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            job_id,
            'queued',
            len(items_data),
            json.dumps(job_data.get('analysisConfig', {})),
            job_data.get('user_notes', ''),
            1 if job_data.get('advancedAllowed', False) else 0,
            job_data.get('advancedBlockedReason', '')
        ))

        # Insert Items
        items_tuples = []
        for item in items_data:
            item_id = str(uuid.uuid4())
            # Store full item data as metadata (excluding url/pageId which are columns)
            meta = item.copy()
            if 'url' in meta: del meta['url']
            if 'pageId' in meta: del meta['pageId']

            items_tuples.append((
                item_id,
                job_id,
                item.get('url'),
                item.get('pageId'),
                'queued',
                json.dumps(meta)
            ))

        c.executemany('''
            INSERT INTO analysis_job_items (
                item_id, job_id, url, page_id, status, item_metadata
            ) VALUES (?, ?, ?, ?, ?, ?)
        ''', items_tuples)

        conn.commit()
        return job_id
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

def get_job(job_id: str) -> Optional[Dict[str, Any]]:
    """Retrieves job details."""
    conn = get_db_connection()
    try:
        c = conn.cursor()
        c.execute("SELECT * FROM analysis_jobs WHERE job_id = ?", (job_id,))
        row = c.fetchone()
        if row:
            d = dict(row)
            if d.get('analysis_config'):
                d['analysis_config'] = json.loads(d['analysis_config'])
            return d
        return None
    finally:
        conn.close()

def get_job_items(job_id: str, status: Optional[List[str]] = None, page: int = 1, page_size: int = 50) -> Dict[str, Any]:
    """Retrieves job items with pagination and optional multi-status filtering."""
    conn = get_db_connection()
    try:
        c = conn.cursor()
        offset = (page - 1) * page_size

        base_query = "SELECT item_id, url, status, finished_at, error_message, item_metadata FROM analysis_job_items WHERE job_id = ?"
        params: List[Any] = [job_id]

        statuses = [entry for entry in (status or []) if entry]
        if statuses:
            placeholders = ', '.join(['?'] * len(statuses))
            base_query += f" AND status IN ({placeholders})"
            params.extend(statuses)

        count_query = f"SELECT COUNT(*) FROM ({base_query}) AS filtered_items"
        c.execute(count_query, params)
        total_items = c.fetchone()[0]

        query = f"{base_query} LIMIT ? OFFSET ?"
        query_params = [*params, page_size, offset]

        c.execute(query, query_params)
        items = [dict(row) for row in c.fetchall()]

        return {
            "items": items,
            "total": total_items,
            "page": page,
            "pageSize": page_size
        }
    finally:
        conn.close()

def get_job_item_result(job_id: str, item_id: str) -> Optional[Dict[str, Any]]:
    """Retrieves full result for an item."""
    conn = get_db_connection()
    try:
        c = conn.cursor()
        c.execute("SELECT result_json FROM analysis_job_items WHERE job_id = ? AND item_id = ?", (job_id, item_id))
        row = c.fetchone()
        if row and row['result_json']:
            return json.loads(row['result_json'])
        return None
    finally:
        conn.close()

def update_job_status(job_id: str, status: str, last_error: str = None) -> None:
    """Updates job status."""
    conn = get_db_connection()
    try:
        c = conn.cursor()
        if last_error:
            c.execute("UPDATE analysis_jobs SET status = ?, last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE job_id = ?", (status, last_error, job_id))
        else:
            c.execute("UPDATE analysis_jobs SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE job_id = ?", (status, job_id))
        conn.commit()
    finally:
        conn.close()

def update_item_status(item_id: str, status: str, result: Dict = None, error: str = None) -> None:
    """Updates item status and result."""
    conn = get_db_connection()
    try:
        c = conn.cursor()
        now = datetime.datetime.utcnow().isoformat()

        updates = ["status = ?"]
        params = [status]

        if status == 'running':
            updates.append("started_at = ?")
            params.append(now)
        elif status in ['done', 'error', 'skipped']:
            updates.append("finished_at = ?")
            params.append(now)

        if result:
            updates.append("result_json = ?")
            params.append(json.dumps(result))

        if error:
            updates.append("error_message = ?")
            params.append(error)

        params.append(item_id)

        query = f"UPDATE analysis_job_items SET {', '.join(updates)} WHERE item_id = ?"
        c.execute(query, params)
        conn.commit()
    finally:
        conn.close()

def get_next_queued_job() -> Optional[Dict[str, Any]]:
    """Gets the next queued job (FIFO)."""
    conn = get_db_connection()
    try:
        c = conn.cursor()
        c.execute("SELECT * FROM analysis_jobs WHERE status = 'queued' ORDER BY created_at ASC LIMIT 1")
        row = c.fetchone()
        if row:
            d = dict(row)
            if d.get('analysis_config'):
                d['analysis_config'] = json.loads(d['analysis_config'])
            return d
        return None
    finally:
        conn.close()

def get_job_items_by_status(job_id: str, status: str) -> List[Dict[str, Any]]:
    """Helper to get full item details for processing."""
    conn = get_db_connection()
    try:
        c = conn.cursor()
        c.execute("SELECT * FROM analysis_job_items WHERE job_id = ? AND status = ?", (job_id, status))
        return [dict(row) for row in c.fetchall()]
    finally:
        conn.close()

def update_job_progress(job_id: str, success_inc: int = 0, error_inc: int = 0, processed_inc: int = 0) -> None:
    """Atomic update of job counters."""
    conn = get_db_connection()
    try:
        c = conn.cursor()
        c.execute('''
            UPDATE analysis_jobs
            SET success_count = success_count + ?,
                error_count = error_count + ?,
                processed_urls = processed_urls + ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE job_id = ?
        ''', (success_inc, error_inc, processed_inc, job_id))
        conn.commit()
    finally:
        conn.close()

# Initialize on module import
# init_db()  # Removed side-effect. Called explicitly in app factory.

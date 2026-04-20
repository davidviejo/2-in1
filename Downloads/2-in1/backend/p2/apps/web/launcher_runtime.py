from __future__ import annotations

from dataclasses import dataclass, field
from itertools import count
from threading import Lock
from typing import Any


VALID_STATES = {'installing', 'starting', 'running', 'stopped', 'error'}


@dataclass
class LauncherRuntimeRecord:
    app_id: str
    installed: bool = False
    state: str = 'stopped'
    pid: int | None = None
    port: int | None = None
    message: str = 'App detenida.'
    error: str | None = None
    logs: list[str] = field(default_factory=list)


class LauncherRuntimeError(Exception):
    def __init__(self, message: str, status_code: int = 400, *, state: str | None = None, error: str | None = None):
        super().__init__(message)
        self.status_code = status_code
        self.state = state
        self.error = error


class LauncherRuntimeService:
    def __init__(self) -> None:
        self._records: dict[str, LauncherRuntimeRecord] = {}
        self._pid_counter = count(12000)
        self._lock = Lock()

    def _record(self, app_id: str) -> LauncherRuntimeRecord:
        record = self._records.get(app_id)
        if record is None:
            record = LauncherRuntimeRecord(app_id=app_id)
            self._records[app_id] = record
        return record

    def _append_log(self, record: LauncherRuntimeRecord, line: str) -> None:
        record.logs.append(line)

    def install(self, app_id: str) -> LauncherRuntimeRecord:
        with self._lock:
            record = self._record(app_id)
            if record.state in {'starting', 'running'}:
                raise LauncherRuntimeError(
                    'No se puede instalar una app en ejecución.',
                    status_code=409,
                    state=record.state,
                )

            record.state = 'installing'
            record.message = 'Instalación en curso.'
            record.error = None
            self._append_log(record, f'[{app_id}] install requested')

            record.installed = True
            record.state = 'stopped'
            record.message = 'Instalación completada.'
            self._append_log(record, f'[{app_id}] install completed')
            return record

    def start(self, app_id: str) -> LauncherRuntimeRecord:
        with self._lock:
            record = self._record(app_id)
            if not record.installed:
                raise LauncherRuntimeError(
                    'La app no está instalada. Ejecuta /install primero.',
                    status_code=409,
                    state=record.state,
                )
            if record.state in {'starting', 'running'}:
                raise LauncherRuntimeError(
                    'La app ya está iniciada.',
                    status_code=409,
                    state=record.state,
                )

            record.state = 'starting'
            record.message = 'Arranque en curso.'
            record.error = None
            self._append_log(record, f'[{app_id}] start requested')

            record.pid = next(self._pid_counter)
            record.state = 'running'
            record.message = 'App en ejecución.'
            self._append_log(record, f'[{app_id}] running pid={record.pid}')
            return record

    def stop(self, app_id: str) -> LauncherRuntimeRecord:
        with self._lock:
            record = self._record(app_id)
            if record.state != 'running':
                raise LauncherRuntimeError(
                    'La app no está en ejecución.',
                    status_code=409,
                    state=record.state,
                )

            record.state = 'stopped'
            record.message = 'App detenida.'
            record.pid = None
            record.error = None
            self._append_log(record, f'[{app_id}] stop requested')
            return record

    def status(self, app_id: str) -> LauncherRuntimeRecord:
        with self._lock:
            return self._record(app_id)

    def logs(self, app_id: str, tail: int = 200) -> tuple[LauncherRuntimeRecord, list[str]]:
        if tail <= 0:
            raise LauncherRuntimeError('El parámetro tail debe ser mayor que 0.', status_code=400)
        with self._lock:
            record = self._record(app_id)
            return record, record.logs[-tail:]


launcher_runtime_service = LauncherRuntimeService()


def serialize_runtime_response(record: LauncherRuntimeRecord, *, ok: bool = True, message: str | None = None,
                               error: str | None = None, state: str | None = None,
                               extra: dict[str, Any] | None = None) -> dict[str, Any]:
    payload = {
        'ok': ok,
        'app_id': record.app_id,
        'state': state or record.state,
        'pid': record.pid,
        'port': record.port,
        'message': message or record.message,
        'error': error,
    }
    if extra:
        payload.update(extra)
    return payload

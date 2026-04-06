import datetime
import logging
from typing import Any, Dict, Optional
from zoneinfo import ZoneInfo

from apps.core.database import (
    get_active_ai_visibility_schedules,
    get_ai_visibility_config,
    insert_ai_visibility_execution_log,
    insert_ai_visibility_run,
    mark_ai_visibility_schedule_run,
)
from apps.web.blueprints.ai_routes import execute_visibility_analysis

logger = logging.getLogger(__name__)


def _parse_iso_datetime(value: Optional[str]) -> Optional[datetime.datetime]:
    if not value:
        return None
    try:
        return datetime.datetime.fromisoformat(str(value).replace('Z', '+00:00'))
    except Exception:
        return None


def _is_schedule_due(schedule: Dict[str, Any], now_utc: datetime.datetime) -> bool:
    tz_name = str(schedule.get('timezone') or 'UTC')
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = ZoneInfo('UTC')

    local_now = now_utc.astimezone(tz)
    run_hour = max(0, min(int(schedule.get('run_hour', 9)), 23))
    run_minute = max(0, min(int(schedule.get('run_minute', 0)), 59))
    target_today = local_now.replace(hour=run_hour, minute=run_minute, second=0, microsecond=0)

    if local_now < target_today:
        return False

    last_run = _parse_iso_datetime(schedule.get('last_run_at'))
    if not last_run:
        return True

    last_local = last_run.astimezone(tz) if last_run.tzinfo else last_run.replace(tzinfo=datetime.timezone.utc).astimezone(tz)
    frequency = str(schedule.get('frequency') or 'daily').lower()

    if frequency == 'weekly':
        return (local_now - last_local) >= datetime.timedelta(days=7)

    return local_now.date() > last_local.date()


def process_ai_visibility_schedules() -> None:
    now_utc = datetime.datetime.now(datetime.timezone.utc)
    schedules = get_active_ai_visibility_schedules()

    for schedule in schedules:
        client_id = str(schedule.get('client_id'))
        if not client_id:
            continue

        if not _is_schedule_due(schedule, now_utc):
            continue

        config = get_ai_visibility_config(client_id)
        if not config:
            insert_ai_visibility_execution_log(
                client_id,
                {
                    'status': 'error',
                    'errorType': 'missing_config',
                    'errorMessage': 'No visibility config found for active schedule',
                    'recoverable': True,
                    'details': {'trigger': 'schedule'},
                },
            )
            continue

        payload = {
            'clientId': client_id,
            'brand': config.get('brand', ''),
            'competitors': config.get('competitors', []),
            'promptTemplate': config.get('prompt_template', ''),
            'sources': config.get('sources', []),
            'providerPriority': config.get('provider_priority', []),
        }

        try:
            result = execute_visibility_analysis(payload)
            saved = insert_ai_visibility_run(
                client_id,
                {
                    'runTrigger': 'scheduled',
                    'requestPayload': payload,
                    'mentions': result.get('mentions', 0),
                    'shareOfVoice': result.get('shareOfVoice', 0),
                    'sentiment': result.get('sentiment', 0),
                    'competitorAppearances': result.get('competitorAppearances', {}),
                    'rawEvidence': result.get('rawEvidence', []),
                    'providerUsed': result.get('providerUsed', ''),
                },
            )
            mark_ai_visibility_schedule_run(client_id, now_utc.isoformat())
            insert_ai_visibility_execution_log(
                client_id,
                {
                    'status': 'ok',
                    'runId': saved.get('id'),
                    'details': {'providerUsed': result.get('providerUsed', '')},
                },
            )
        except Exception as exc:
            error_message = str(exc)
            recoverable = any(
                token in error_message.lower() for token in ('timeout', 'rate', 'unavailable', 'temporarily', '429', '503')
            )
            error_type = 'provider_error'
            if 'timeout' in error_message.lower():
                error_type = 'timeout'
            elif 'rate' in error_message.lower() or '429' in error_message.lower():
                error_type = 'rate_limit'
            elif 'unavailable' in error_message.lower() or '503' in error_message.lower():
                error_type = 'provider_unavailable'

            logger.warning('Scheduled visibility run failed for client=%s: %s', client_id, error_message)
            insert_ai_visibility_execution_log(
                client_id,
                {
                    'status': 'error',
                    'errorType': error_type,
                    'errorMessage': error_message,
                    'recoverable': recoverable,
                    'details': {'trigger': 'schedule'},
                },
            )

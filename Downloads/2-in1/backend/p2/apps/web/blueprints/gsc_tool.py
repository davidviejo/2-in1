# apps/gsc_tool.py
from flask import Blueprint, render_template, jsonify, request
from apps.web.blueprints.project_manager import get_active_project
import random
import os
import logging
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

# Importaciones condicionales de Google
try:
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
    GOOGLE_LIBS = True
except ImportError:
    GOOGLE_LIBS = False

gsc_bp = Blueprint('gsc_bp', __name__)
CREDENTIALS_FILE = 'gsc_credentials.json' # Debes poner tu JSON de Google Cloud aquí
URL_INSPECTION_SCOPES = ['https://www.googleapis.com/auth/webmasters.readonly']
DEFAULT_INSPECTION_LANGUAGE = 'es-ES'
MAX_INSPECTION_URLS = 20
MAX_INSPECTION_RETRIES = 2

def get_gsc_service():
    """Autenticación con Google"""
    if not GOOGLE_LIBS or not os.path.exists(CREDENTIALS_FILE):
        return None
    try:
        creds = service_account.Credentials.from_service_account_file(
            CREDENTIALS_FILE, scopes=['https://www.googleapis.com/auth/webmasters.readonly']
        )
        return build('searchconsole', 'v1', credentials=creds)
    except Exception:
        return None

def get_secure_gsc_service() -> Optional[Any]:
    """
    Autenticación recomendada para backend proxy:
    - GSC_SERVICE_ACCOUNT_FILE=/ruta/credenciales.json
    - GSC_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
    """
    if not GOOGLE_LIBS:
        return None

    file_path = os.environ.get('GSC_SERVICE_ACCOUNT_FILE')
    raw_json = os.environ.get('GSC_SERVICE_ACCOUNT_JSON')

    try:
        if file_path and os.path.exists(file_path):
            creds = service_account.Credentials.from_service_account_file(file_path, scopes=URL_INSPECTION_SCOPES)
        elif raw_json:
            from json import loads
            creds_info = loads(raw_json)
            creds = service_account.Credentials.from_service_account_info(creds_info, scopes=URL_INSPECTION_SCOPES)
        else:
            return None
        return build('searchconsole', 'v1', credentials=creds, cache_discovery=False)
    except Exception as exc:
        logging.exception("No se pudo inicializar Search Console URL Inspection service: %s", exc)
        return None

def normalize_inspection_result(url: str, raw_result: Dict[str, Any]) -> Dict[str, Any]:
    result = raw_result.get('inspectionResult', {}) if isinstance(raw_result, dict) else {}
    index_status = result.get('indexStatusResult', {}) if isinstance(result, dict) else {}
    mobile_result = result.get('mobileUsabilityResult', {}) if isinstance(result, dict) else {}
    rich_result = result.get('richResultsResult', {}) if isinstance(result, dict) else {}

    return {
        'url': url,
        'verdict': index_status.get('verdict') or 'UNKNOWN',
        'coverageState': index_status.get('coverageState') or 'UNKNOWN',
        'indexingState': index_status.get('indexingState') or 'UNKNOWN',
        'lastCrawlTime': index_status.get('lastCrawlTime'),
        'googleCanonical': index_status.get('googleCanonical'),
        'userCanonical': index_status.get('userCanonical'),
        'referringUrls': index_status.get('referringUrls') or [],
        'robotsTxtState': index_status.get('robotsTxtState'),
        'pageFetchState': index_status.get('pageFetchState'),
        'crawledAs': index_status.get('crawledAs'),
        'mobileUsabilityVerdict': mobile_result.get('verdict'),
        'richResultsVerdict': rich_result.get('verdict'),
        'raw': raw_result,
    }

def classify_inspection_error(error: Exception) -> Dict[str, Any]:
    default_code = 'inspection_error'
    default_status = 500
    default_message = str(error)

    if isinstance(error, HttpError):
        default_status = int(getattr(error.resp, 'status', 500))
        try:
            payload = error.error_details if hasattr(error, 'error_details') else None
        except Exception:
            payload = None
        status_code = default_status
        if status_code == 429 or status_code >= 500:
            default_code = 'transient_google_error'
        elif status_code in (401, 403):
            default_code = 'gsc_auth_or_permission_error'
        if 'quota' in default_message.lower():
            default_code = 'quota_exceeded'
    return {
        'code': default_code,
        'status': default_status,
        'message': default_message,
    }

def inspect_with_retry(service: Any, site_url: str, url: str, language_code: str) -> Dict[str, Any]:
    last_error: Optional[Exception] = None
    for attempt in range(MAX_INSPECTION_RETRIES + 1):
        try:
            body = {
                'inspectionUrl': url,
                'siteUrl': site_url,
                'languageCode': language_code,
            }
            response = service.urlInspection().index().inspect(body=body).execute()
            return {
                'ok': True,
                'attempts': attempt + 1,
                'data': normalize_inspection_result(url, response),
            }
        except Exception as exc:
            last_error = exc
            parsed = classify_inspection_error(exc)
            should_retry = parsed['code'] in ('transient_google_error', 'quota_exceeded') and attempt < MAX_INSPECTION_RETRIES
            if not should_retry:
                return {
                    'ok': False,
                    'attempts': attempt + 1,
                    'error': parsed,
                }
            # backoff conservador para evitar castigar cuotas
            time.sleep(0.5 * (attempt + 1))
    parsed_last = classify_inspection_error(last_error or Exception('unknown_error'))
    return {
        'ok': False,
        'attempts': MAX_INSPECTION_RETRIES + 1,
        'error': parsed_last,
    }

@gsc_bp.route('/gsc/dashboard')
def dashboard():
    return render_template('gsc/dashboard.html')

@gsc_bp.route('/gsc/data', methods=['POST'])
def get_data():
    project = get_active_project() or {}
    domain = project.get('domain')

    if not domain:
        return jsonify({"error": "Selecciona un proyecto activo con dominio antes de consultar GSC."}), 400

    # Asegurar formato GSC (sc-domain:midominio.com o https://...)
    if not domain.startswith('http') and not domain.startswith('sc-domain:'):
        site_url = f"sc-domain:{domain}"
    else:
        site_url = domain

    service = get_gsc_service()

    # Fechas (Últimos 28 días)
    end_date = datetime.now().strftime("%Y-%m-%d")
    start_date = (datetime.now() - timedelta(days=28)).strftime("%Y-%m-%d")

    data_rows = []

    if service:
        # --- MODO REAL (Si existe gsc_credentials.json) ---
        try:
            req = {
                'startDate': start_date,
                'endDate': end_date,
                'dimensions': ['date'],
                'rowLimit': 30
            }
            resp = service.searchanalytics().query(siteUrl=site_url, body=req).execute()
            rows = resp.get('rows', [])
            for r in rows:
                data_rows.append({
                    "date": r['keys'][0],
                    "clicks": r['clicks'],
                    "impressions": r['impressions'],
                    "ctr": round(r['ctr'] * 100, 2),
                    "position": round(r['position'], 1)
                })
        except Exception as e:
            logging.error(f"GSC Error: {str(e)}")
            return jsonify({"error": "Error conectando a GSC. Verifica permisos."}), 502

    else:
        # --- MODO DEMO (Para que veas la gráfica sin configurar API) ---
        base_clicks = random.randint(100, 500)
        for i in range(28):
            day = (datetime.now() - timedelta(days=28-i)).strftime("%Y-%m-%d")
            trend = (i * 2) + random.randint(-10, 20)
            clicks = max(0, base_clicks + trend)
            imps = clicks * random.randint(15, 25)
            data_rows.append({
                "date": day,
                "clicks": clicks,
                "impressions": imps,
                "ctr": round((clicks / imps) * 100, 2) if imps > 0 else 0,
                "position": round(random.uniform(8, 12), 1)
            })

    totals = {
        "clicks": sum(row['clicks'] for row in data_rows),
        "impressions": sum(row['impressions'] for row in data_rows),
    }
    totals["ctr"] = round((totals['clicks'] / totals['impressions']) * 100, 2) if totals['impressions'] else 0
    totals["avg_position"] = round(sum(row['position'] for row in data_rows) / len(data_rows), 1) if data_rows else 0

    midpoint = max(1, len(data_rows) // 2)
    previous_period = data_rows[:midpoint]
    current_period = data_rows[midpoint:]

    def metric_sum(rows, key):
        return sum(row[key] for row in rows)

    def metric_avg(rows, key):
        return round(sum(row[key] for row in rows) / len(rows), 2) if rows else 0

    periods = {
        "previous": {
            "clicks": metric_sum(previous_period, 'clicks'),
            "impressions": metric_sum(previous_period, 'impressions'),
            "ctr": metric_avg(previous_period, 'ctr'),
            "position": metric_avg(previous_period, 'position'),
        },
        "current": {
            "clicks": metric_sum(current_period, 'clicks'),
            "impressions": metric_sum(current_period, 'impressions'),
            "ctr": metric_avg(current_period, 'ctr'),
            "position": metric_avg(current_period, 'position'),
        }
    }

    chart_data = {
        "labels": [r['date'] for r in data_rows],
        "clicks": [r['clicks'] for r in data_rows],
        "impressions": [r['impressions'] for r in data_rows],
        "position": [r['position'] for r in data_rows],
        "ctr": [r['ctr'] for r in data_rows]
    }

    return jsonify({
        "status": "success",
        "mode": "REAL" if service else "DEMO",
        "site": site_url,
        "range": {
            "start": start_date,
            "end": end_date,
            "days": len(data_rows)
        },
        "chart": chart_data,
        "rows": data_rows,
        "totals": totals,
        "periods": periods
    })

@gsc_bp.route('/api/gsc/url-inspection/batch', methods=['POST'])
def inspect_urls_batch():
    payload = request.get_json(silent=True) or {}
    site_url = str(payload.get('siteUrl') or '').strip()
    urls = payload.get('urls') or []
    language_code = str(payload.get('languageCode') or DEFAULT_INSPECTION_LANGUAGE).strip() or DEFAULT_INSPECTION_LANGUAGE

    if not site_url:
        return jsonify({'error': 'siteUrl es obligatorio.', 'code': 'validation_error'}), 400
    if not isinstance(urls, list) or len(urls) == 0:
        return jsonify({'error': 'Debes enviar al menos una URL a inspeccionar.', 'code': 'validation_error'}), 400

    normalized_urls: List[str] = []
    for candidate in urls[:MAX_INSPECTION_URLS]:
        if not isinstance(candidate, str):
            continue
        trimmed = candidate.strip()
        if trimmed.startswith('http://') or trimmed.startswith('https://'):
            normalized_urls.append(trimmed)

    if not normalized_urls:
        return jsonify({'error': 'No se recibieron URLs válidas (http/https).', 'code': 'validation_error'}), 400

    service = get_secure_gsc_service()
    if not service:
        return jsonify({
            'error': 'URL Inspection no está configurado en backend. Define GSC_SERVICE_ACCOUNT_FILE o GSC_SERVICE_ACCOUNT_JSON.',
            'code': 'missing_backend_credentials',
        }), 503

    inspected: List[Dict[str, Any]] = []
    failed: List[Dict[str, Any]] = []
    quota_hit = False

    for url in normalized_urls:
        result = inspect_with_retry(service, site_url, url, language_code)
        if result.get('ok'):
            inspected.append(result.get('data', {}))
        else:
            error = result.get('error', {})
            failed.append({
                'url': url,
                'attempts': result.get('attempts', 1),
                'error': error,
            })
            if error.get('code') == 'quota_exceeded':
                quota_hit = True

    status = 'ok'
    if failed and inspected:
        status = 'partial'
    elif failed and not inspected:
        status = 'error'

    response_payload = {
        'status': status,
        'siteUrl': site_url,
        'languageCode': language_code,
        'results': inspected,
        'errors': failed,
        'meta': {
            'requestedCount': len(urls),
            'processedCount': len(normalized_urls),
            'successCount': len(inspected),
            'errorCount': len(failed),
            'quotaHit': quota_hit,
            'maxUrlsPerRequest': MAX_INSPECTION_URLS,
            'maxRetries': MAX_INSPECTION_RETRIES,
        },
    }

    status_code = 200
    if status == 'error':
        status_code = 502
    elif status == 'partial':
        status_code = 207

    return jsonify(response_payload), status_code

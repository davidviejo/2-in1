# apps/gsc_tool.py
from flask import Blueprint, render_template, jsonify
from apps.web.blueprints.project_manager import get_active_project
import random
import os
import logging
from datetime import datetime, timedelta

# Importaciones condicionales de Google
try:
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    GOOGLE_LIBS = True
except ImportError:
    GOOGLE_LIBS = False

gsc_bp = Blueprint('gsc_bp', __name__)
CREDENTIALS_FILE = 'gsc_credentials.json' # Debes poner tu JSON de Google Cloud aquí

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

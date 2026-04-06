from flask import Blueprint, jsonify
import sqlite3
import logging
from datetime import date
import os

usage_bp = Blueprint('usage', __name__, url_prefix='/usage')

# RUTA ABSOLUTA AL ARCHIVO DB (En la misma carpeta apps o en la raíz)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_FILE = os.path.join(BASE_DIR, '..', '..', '..', 'data', 'api_usage.db')

_DB_INITIALIZED = False

def init_db():
    """Inicializa la tabla"""
    global _DB_INITIALIZED
    if _DB_INITIALIZED:
        return
    try:
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        c.execute('''CREATE TABLE IF NOT EXISTS daily_usage 
                     (day_date TEXT PRIMARY KEY, count INTEGER)''')
        conn.commit()
        conn.close()
        _DB_INITIALIZED = True
    except Exception as e:
        logging.error(f"Error iniciando DB: {e}")

def increment_api_usage(amount=1):
    init_db()
    today = str(date.today())
    try:
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        c.execute("INSERT OR IGNORE INTO daily_usage (day_date, count) VALUES (?, 0)", (today,))
        c.execute("UPDATE daily_usage SET count = count + ? WHERE day_date = ?", (amount, today))
        conn.commit()
        conn.close()
    except Exception as e:
        logging.error(f"Error update DB: {e}")

def get_today_usage():
    init_db()
    today = str(date.today())
    count = 0
    try:
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        c.execute("SELECT count FROM daily_usage WHERE day_date = ?", (today,))
        row = c.fetchone()
        if row: count = row[0]
        conn.close()
    except Exception: pass
    return count

@usage_bp.route('/stats')
def stats():
    count = get_today_usage()
    percent = min(100, (count / 100) * 100)
    color = 'bg-success'
    if count > 80: color = 'bg-warning'
    if count >= 100: color = 'bg-danger'
    return jsonify({'count': count, 'limit': 100, 'percent': percent, 'color': color})
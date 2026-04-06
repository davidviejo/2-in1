# apps/workflow_tool.py
from flask import Blueprint, render_template, jsonify

workflow_bp = Blueprint('workflow_bp', __name__)

@workflow_bp.route('/workflow/master')
def master_dashboard():
    return render_template('workflow/dashboard.html')

@workflow_bp.route('/workflow/data')
def get_workflow_data():
    methodology = [
        {
            "phase": "1. DESGLOSE (10%)",
            "desc": "Configuración, Auditoría Técnica y Setup.",
            "color": "success",
            "steps": [
                {"name": "Fast Status", "url": "/fast", "desc": "Checkeo rápido de respuesta 200.", "icon": "fa-bolt"},
                {"name": "Auditor Técnico", "url": "/audit", "desc": "Escaneo inicial (H1, Metas).", "icon": "fa-bug"},
                {"name": "Tech Detector", "url": "/tech", "desc": "Stack tecnológico.", "icon": "fa-memory"},
                {"name": "WPO Lab", "url": "/wpo", "desc": "Velocidad Core Web Vitals.", "icon": "fa-tachometer-alt"}
            ]
        },
        {
            "phase": "2. INSPIRACIÓN (20%)",
            "desc": "Estrategia, Mercado y Keyword Research.",
            "color": "info",
            "steps": [
                {"name": "EcoTrends", "url": "/trends/media", "desc": "Paso 0: Oportunidades de mercado.", "icon": "fa-chart-line"},
                {"name": "KW Discovery", "url": "/suggest", "desc": "Lluvia de ideas.", "icon": "fa-lightbulb"},
                {"name": "SEO Cluster", "url": "/seo", "desc": "KR Maestro (Agrupación).", "icon": "fa-layer-group"},
                {"name": "Content Gap", "url": "/gap", "desc": "Espionaje competidores.", "icon": "fa-balance-scale"}
            ]
        },
        {
            "phase": "3. AVANCE (50%)",
            "desc": "Producción, On-Page y Estructura.",
            "color": "warning",
            "steps": [
                {"name": "Header Map", "url": "/structure", "desc": "Estructura H2/H3.", "icon": "fa-list-ol"},
                {"name": "Draft Editor", "url": "/draft", "desc": "Redacción optimizada.", "icon": "fa-pencil-alt"},
                {"name": "NLP Analyzer", "url": "/nlp", "desc": "Entidades y sentimiento.", "icon": "fa-brain"},
                {"name": "Link Opps", "url": "/opps", "desc": "Enlazado interno.", "icon": "fa-link"}
            ]
        },
        {
            "phase": "4. REPUTACIÓN (20%)",
            "desc": "Autoridad Off-Page y Salud.",
            "color": "primary",
            "steps": [
                {"name": "Link Health", "url": "/health", "desc": "Limpieza enlaces rotos.", "icon": "fa-user-md"},
                {"name": "Outreach", "url": "/leads", "desc": "Contactos para links.", "icon": "fa-envelope-open-text"},
                {"name": "Dominios Exp.", "url": "/expired", "desc": "Oportunidades expiradas.", "icon": "fa-hourglass-end"},
                {"name": "E-E-A-T Trust", "url": "/eeat", "desc": "Señales de confianza.", "icon": "fa-shield-alt"}
            ]
        }
    ]
    return jsonify(methodology)
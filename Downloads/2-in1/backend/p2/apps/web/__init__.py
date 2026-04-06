from flask import Flask, render_template, jsonify, redirect, request
from apps.core.config import Config
from apps.core.database import init_db

# --- IMPORTACIÓN DE TODAS LAS APPS EXISTENTES ---
from apps.web.blueprints.seo_tool import seo_bp
from apps.web.blueprints.ai_fixer import ai_bp as ai_fixer_bp
from apps.web.blueprints.gsc_tool import gsc_bp
from apps.monitor_daemon import start_monitor, GLOBAL_ALERTS
from apps.web.blueprints.entity_tool import entity_bp
from apps.web.blueprints.audit_tool import audit_bp
from apps.web.blueprints.content_gap import gap_bp
from apps.web.blueprints.checklist_tool import checklist_bp
from apps.web.blueprints.tools_extra import extra_bp
from apps.web.blueprints.nlp_tool import nlp_bp
from apps.web.blueprints.eeat_tool import eeat_bp
from apps.web.blueprints.link_graph import graph_bp
from apps.web.blueprints.structure_tool import structure_bp
from apps.web.blueprints.link_opps import opps_bp
from apps.web.blueprints.intent_tool import intent_bp
from apps.web.blueprints.wpo_tool import wpo_bp
from apps.web.blueprints.index_tool import index_bp
from apps.web.blueprints.redirect_tool import redirect_bp
from apps.web.blueprints.local_tool import local_bp
from apps.web.blueprints.prominence_tool import prominence_bp
from apps.web.blueprints.diff_tool import diff_bp
from apps.web.blueprints.suggest_tool import suggest_bp
from apps.core_monitor import GLOBAL_STATE
from apps.web.blueprints.link_health import health_bp
from apps.web.blueprints.meta_gen import meta_gen_bp
from apps.web.blueprints.image_audit import image_bp
from apps.web.blueprints.bot_sim import bot_bp
from apps.web.blueprints.hreflang_tool import hreflang_bp
from apps.web.blueprints.content_extract import extract_bp
from apps.web.blueprints.social_tool import social_bp
from apps.web.blueprints.schema_tool import schema_bp
from apps.web.blueprints.robots_tool import robots_bp
from apps.web.blueprints.decay_tool import decay_bp
from apps.web.blueprints.index_checker import indexer_bp
from apps.web.blueprints.migration_tool import migration_bp
from apps.web.blueprints.headers_tool import headers_bp
from apps.web.blueprints.leads_tool import leads_bp
from apps.web.blueprints.duplicate_tool import duplicate_bp
from apps.web.blueprints.overlap_tool import overlap_bp
from apps.web.blueprints.dorks_tool import dorks_bp
from apps.web.blueprints.status_fast import fast_bp
from apps.web.blueprints.tech_detector import tech_bp
from apps.web.blueprints.ratio_tool import ratio_bp
from apps.web.blueprints.sculpting_tool import sculpting_bp
from apps.web.blueprints.draft_tool import draft_bp
from apps.web.blueprints.pixel_tool import pixel_bp
from apps.web.blueprints.anchor_tool import anchor_bp
from apps.web.blueprints.crawler_tool import crawler_bp
from apps.web.blueprints.kw_intent import kw_intent_bp
from apps.web.blueprints.depth_tool import depth_bp
from apps.web.blueprints.utm_tool import utm_bp
from apps.web.blueprints.log_tool import log_bp
from apps.web.blueprints.ctr_tool import ctr_bp
from apps.web.blueprints.roi_tool import roi_bp
from apps.web.blueprints.local_nap import nap_bp
from apps.web.blueprints.expired_tool import expired_bp
from apps.web.blueprints.benchmark_tool import benchmark_bp
from apps.web.blueprints.usage_tracker import usage_bp
from apps.web.blueprints.ops_cleaner import cleaner_bp
from apps.web.blueprints.ops_frameworks import frameworks_bp
from apps.web.blueprints.readability_tool import readability_bp
from apps.web.blueprints.schema_detector import schema_detector_bp
from apps.web.blueprints.autopilot import autopilot_bp
from apps.web.blueprints.trends_economy import trends_bp
from apps.web.blueprints.project_manager import project_bp, get_active_project
from apps.web.blueprints.workflow_tool import workflow_bp
from apps.web.blueprints.snippet_tool import snippet_bp
from apps.web.blueprints.enhance_tool import enhance_bp
from apps.web.blueprints.ai_routes import ai_bp as ai_tools_bp
from apps.web.blueprints.api_engine import api_engine_bp
from apps.web.blueprints.seo_tfidf import seo_tfidf_bp, seo_tfidf_v1_bp
from apps.web.api_routes_map import (
    API_V1_PREFIX,
    map_legacy_path_to_v1,
    should_redirect_legacy_path,
)

# Portal Auth
from apps.web.auth_bp import auth_bp
from apps.web.portal_bp import portal_bp
from apps.auth_utils import hash_password
from apps.job_runner import JobRunner

def create_app(config_class=Config):
    # Inicializar base de datos
    init_db()

    app = Flask(__name__, template_folder='../../templates', static_folder='../../static')
    app.config.from_object(config_class)

    # --- SECURITY: Auto-hash passwords if plain text ---
    clients_pass = app.config.get('CLIENTS_AREA_PASSWORD')
    if clients_pass and not clients_pass.startswith('$2'):
        app.config['CLIENTS_AREA_PASSWORD'] = hash_password(clients_pass)
        # print(f"DEBUG: Hashed CLIENTS_AREA_PASSWORD")

    operator_pass = app.config.get('OPERATOR_PASSWORD')
    if operator_pass and not operator_pass.startswith('$2'):
        app.config['OPERATOR_PASSWORD'] = hash_password(operator_pass)
        # print(f"DEBUG: Hashed OPERATOR_PASSWORD")

    # --- REGISTRO DE BLUEPRINTS ---
    app.register_blueprint(autopilot_bp)
    app.register_blueprint(entity_bp)
    app.register_blueprint(schema_detector_bp)
    app.register_blueprint(readability_bp)
    app.register_blueprint(seo_bp)
    app.register_blueprint(audit_bp)
    app.register_blueprint(gap_bp)
    app.register_blueprint(ai_fixer_bp)
    app.register_blueprint(gsc_bp)
    app.register_blueprint(checklist_bp)
    app.register_blueprint(extra_bp)
    app.register_blueprint(nlp_bp)
    app.register_blueprint(eeat_bp)
    app.register_blueprint(graph_bp)
    app.register_blueprint(structure_bp)
    app.register_blueprint(opps_bp)
    app.register_blueprint(intent_bp)
    app.register_blueprint(wpo_bp)
    app.register_blueprint(index_bp)
    app.register_blueprint(redirect_bp)
    app.register_blueprint(local_bp)
    app.register_blueprint(prominence_bp)
    app.register_blueprint(diff_bp)
    app.register_blueprint(suggest_bp)
    app.register_blueprint(health_bp)
    app.register_blueprint(meta_gen_bp)
    app.register_blueprint(image_bp)
    app.register_blueprint(bot_bp)
    app.register_blueprint(hreflang_bp)
    app.register_blueprint(extract_bp)
    app.register_blueprint(social_bp)
    app.register_blueprint(schema_bp)
    app.register_blueprint(robots_bp)
    app.register_blueprint(decay_bp)
    app.register_blueprint(indexer_bp)
    app.register_blueprint(migration_bp)
    app.register_blueprint(headers_bp)
    app.register_blueprint(leads_bp)
    app.register_blueprint(duplicate_bp)
    app.register_blueprint(overlap_bp)
    app.register_blueprint(dorks_bp)
    app.register_blueprint(fast_bp)
    app.register_blueprint(tech_bp)
    app.register_blueprint(ratio_bp)
    app.register_blueprint(sculpting_bp)
    app.register_blueprint(draft_bp)
    app.register_blueprint(pixel_bp)
    app.register_blueprint(anchor_bp)
    app.register_blueprint(crawler_bp)
    app.register_blueprint(kw_intent_bp)
    app.register_blueprint(depth_bp)
    app.register_blueprint(utm_bp)
    app.register_blueprint(log_bp)
    app.register_blueprint(ctr_bp)
    app.register_blueprint(roi_bp)
    app.register_blueprint(nap_bp)
    app.register_blueprint(expired_bp)
    app.register_blueprint(benchmark_bp)
    app.register_blueprint(usage_bp)
    app.register_blueprint(cleaner_bp)
    app.register_blueprint(frameworks_bp)
    app.register_blueprint(trends_bp)
    app.register_blueprint(project_bp)
    app.register_blueprint(workflow_bp)
    app.register_blueprint(snippet_bp)
    app.register_blueprint(enhance_bp)
    app.register_blueprint(ai_tools_bp)
    app.register_blueprint(api_engine_bp)
    app.register_blueprint(seo_tfidf_bp)
    app.register_blueprint(seo_tfidf_v1_bp)

    app.register_blueprint(auth_bp)
    app.register_blueprint(portal_bp)

    # --- API ALIASING ---
    register_api_v1_aliases(app)

    @app.before_request
    def redirect_legacy_api_routes():
        if request.path.startswith(API_V1_PREFIX):
            return None
        if not should_redirect_legacy_path(request.path):
            return None
        target_path = map_legacy_path_to_v1(request.path)
        if request.query_string:
            target_path = f"{target_path}?{request.query_string.decode('utf-8')}"
        return redirect(target_path, code=307)

    # --- CONTEXT PROCESSOR ---
    @app.context_processor
    def inject_project():
        return dict(current_project=get_active_project())

    # --- RUTAS GLOBALES ---
    @app.route('/global-status')
    def global_status():
        return jsonify(GLOBAL_STATE)

    @app.route('/monitor/alerts')
    def get_alerts():
        return jsonify(list(GLOBAL_ALERTS))

    @app.route('/api/health')
    def health_check():
        return jsonify({"status": "ok"})

    @app.route('/')
    def home():
        return render_template('portal.html')

    # Iniciar el vigilante (solo si no estamos testeando, aunque no tenemos flag de testing aun)
    if not app.config.get('TESTING'):
        start_monitor()
        JobRunner.start_worker()

    return app


def register_api_v1_aliases(app):
    """
    Register `/api/v1/...` aliases for tool endpoints to provide
    a unified API namespace while keeping legacy endpoints available.
    """
    existing_rules = [rule for rule in app.url_map.iter_rules()]
    for idx, rule in enumerate(existing_rules):
        if _should_skip_alias_rule(rule):
            continue

        new_rule = f"{API_V1_PREFIX}{rule.rule}"
        if _rule_already_exists(app, new_rule):
            continue

        view_func = app.view_functions[rule.endpoint]
        methods = sorted(m for m in rule.methods if m not in {'HEAD', 'OPTIONS'})
        app.add_url_rule(
            new_rule,
            endpoint=f"api_v1_alias_{idx}_{rule.endpoint}",
            view_func=view_func,
            defaults=rule.defaults,
            methods=methods,
            strict_slashes=rule.strict_slashes,
        )


def _should_skip_alias_rule(rule):
    if rule.endpoint == 'static':
        return True
    if rule.rule.startswith(API_V1_PREFIX):
        return True
    return rule.rule.startswith(('/seo', '/monitor', '/global-status', '/api/'))


def _rule_already_exists(app, candidate_rule):
    return any(existing.rule == candidate_rule for existing in app.url_map.iter_rules())

from flask import Flask, jsonify, redirect, render_template, request

from apps.auth_utils import hash_password
from apps.core.config import Config
from apps.core.database import init_db
from apps.core_monitor import GLOBAL_STATE
from apps.job_runner import JobRunner
from apps.monitor_daemon import GLOBAL_ALERTS, start_monitor
from apps.web.api_routes_map import (
    API_V1_PREFIX,
    map_legacy_path_to_v1,
    should_redirect_legacy_path,
)
from apps.web.blueprints.project_manager import get_active_project
from apps.web.domains.registry import register_core_blueprints, register_domain_blueprints


def create_app(config_class=Config):
    config_class.validate_required_settings(getattr(config_class, 'TESTING', False))

    # Inicializar base de datos
    init_db()

    app = Flask(__name__, template_folder='../../templates', static_folder='../../static')
    app.config.from_object(config_class)

    # --- SECURITY: Auto-hash passwords if plain text ---
    clients_pass = app.config.get('CLIENTS_AREA_PASSWORD')
    if clients_pass and not clients_pass.startswith('$2'):
        app.config['CLIENTS_AREA_PASSWORD'] = hash_password(clients_pass)

    operator_pass = app.config.get('OPERATOR_PASSWORD')
    if operator_pass and not operator_pass.startswith('$2'):
        app.config['OPERATOR_PASSWORD'] = hash_password(operator_pass)

    # --- REGISTRO DE BLUEPRINTS (declarativo) ---
    register_core_blueprints(app)
    register_domain_blueprints(app)

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

    if not app.config.get('TESTING'):
        start_monitor()

        auto_start_job_runner = str(app.config.get('AUTO_START_JOB_RUNNER', 'false')).strip().lower() in {
            '1', 'true', 'yes', 'on'
        }
        if auto_start_job_runner:
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

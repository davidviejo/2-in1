from flask import Flask

from apps.web.auth_bp import auth_bp
from apps.web.portal_bp import portal_bp
from apps.web.blueprints.ai_routes import ai_bp as ai_tools_bp
from apps.web.blueprints.api_engine import api_engine_bp
from apps.web.blueprints.project_api import project_api_bp
from apps.web.blueprints.project_manager import project_bp
from apps.web.domains.taxonomy import DOMAIN_PREFIXES

DOMAIN_BLUEPRINTS = {
    'client-management': (project_api_bp, project_bp),
    'seo-engine': (ai_tools_bp, api_engine_bp),
    'portal-auth': (auth_bp, portal_bp),
    'legacy-tools': (),
}


def register_domain_blueprints(app: Flask) -> None:
    """
    Register domain-scoped API routes using versioned prefixes.
    Legacy routes remain available through the default blueprint registration.
    """
    for domain, blueprints in DOMAIN_BLUEPRINTS.items():
        domain_prefix = DOMAIN_PREFIXES[domain]
        for blueprint in blueprints:
            app.register_blueprint(
                blueprint,
                name=f"{blueprint.name}_{domain.replace('-', '_')}_v1",
                url_prefix=domain_prefix,
            )

from __future__ import annotations

from flask import current_app

from apps.web.domains.registry import DOMAIN_BOOTSTRAP, _resolve_blueprint


STATUS_ORDER = {
    'legacy': 0,
    'migrada': 1,
    'beta': 2,
}


def _iter_tool_specs(bootstrap=DOMAIN_BOOTSTRAP):
    for group in bootstrap:
        for spec in group.core:
            if spec.tool_metadata is not None:
                yield spec


def get_tools_catalog(app=None, bootstrap=DOMAIN_BOOTSTRAP):
    app = app or current_app
    registered_blueprints = set(app.blueprints.keys())
    disabled_ids = {
        item.strip() for item in str(app.config.get('TOOLS_DISABLED_IDS', '')).split(',') if item.strip()
    }
    degraded_ids = {
        item.strip() for item in str(app.config.get('TOOLS_DEGRADED_IDS', '')).split(',') if item.strip()
    }

    tools = []
    seen_ids = set()

    for spec in _iter_tool_specs(bootstrap):
        metadata = spec.tool_metadata
        if metadata.id in seen_ids:
            continue

        blueprint = _resolve_blueprint(spec)
        enabled = blueprint.name in registered_blueprints and metadata.availability_flag and metadata.id not in disabled_ids

        missing_credentials = [
            key for key in metadata.required_credentials if not app.config.get(key)
        ]
        requires_credentials = bool(metadata.required_credentials)
        degraded = bool(missing_credentials) or metadata.id in degraded_ids

        tools.append(
            {
                'id': metadata.id,
                'name': metadata.name,
                'path': metadata.path,
                'status': metadata.status,
                'description': metadata.description,
                'available': metadata.availability_flag,
                'runtime': {
                    'enabled': enabled,
                    'requires_credentials': requires_credentials,
                    'degraded': degraded,
                },
            }
        )
        seen_ids.add(metadata.id)

    return sorted(tools, key=lambda item: (STATUS_ORDER.get(item['status'], 99), item['name'].lower()))

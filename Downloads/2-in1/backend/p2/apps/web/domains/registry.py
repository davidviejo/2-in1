from __future__ import annotations

from importlib import import_module
from typing import Dict, Iterable, List, NamedTuple, Sequence, Tuple

from flask import Flask

from apps.web.domains.taxonomy import DOMAIN_PREFIXES


class BlueprintSpec(NamedTuple):
    module_path: str
    blueprint_attr: str


class DomainBootstrap(NamedTuple):
    domain: str
    core: Sequence[BlueprintSpec]
    namespaced: Sequence[BlueprintSpec]
    notes: Sequence[str]


# Registro central y declarativo para blueprint loading.
# El orden en `core` es crítico: auth/portal se registran antes de dominios API
# y project-manager precede project-api para mantener dependencias implícitas
# de helpers y contexto de proyecto activo.
DOMAIN_BOOTSTRAP: Sequence[DomainBootstrap] = (
    DomainBootstrap(
        domain='portal',
        core=(
            BlueprintSpec('apps.web.auth_bp', 'auth_bp'),
            BlueprintSpec('apps.web.portal_bp', 'portal_bp'),
        ),
        namespaced=(
            BlueprintSpec('apps.web.auth_bp', 'auth_bp'),
            BlueprintSpec('apps.web.portal_bp', 'portal_bp'),
        ),
        notes=(
            'Registrar auth antes que portal para preservar login y guards.',
        ),
    ),
    DomainBootstrap(
        domain='ai',
        core=(
            BlueprintSpec('apps.web.blueprints.ai_fixer', 'ai_bp'),
            BlueprintSpec('apps.web.blueprints.ai_routes', 'ai_bp'),
            BlueprintSpec('apps.web.blueprints.autopilot', 'autopilot_bp'),
            BlueprintSpec('apps.web.blueprints.enhance_tool', 'enhance_bp'),
            BlueprintSpec('apps.web.blueprints.snippet_tool', 'snippet_bp'),
        ),
        namespaced=(
            BlueprintSpec('apps.web.blueprints.ai_routes', 'ai_bp'),
        ),
        notes=(
            'ai_routes expone /api/settings/* y debe permanecer disponible en legacy + v1.',
        ),
    ),
    DomainBootstrap(
        domain='seo-core',
        core=(
            BlueprintSpec('apps.web.blueprints.project_manager', 'project_bp'),
            BlueprintSpec('apps.web.blueprints.project_api', 'project_api_bp'),
            BlueprintSpec('apps.web.blueprints.seo_tool', 'seo_bp'),
            BlueprintSpec('apps.web.blueprints.audit_tool', 'audit_bp'),
            BlueprintSpec('apps.web.blueprints.content_gap', 'gap_bp'),
            BlueprintSpec('apps.web.blueprints.entity_tool', 'entity_bp'),
            BlueprintSpec('apps.web.blueprints.schema_detector', 'schema_detector_bp'),
            BlueprintSpec('apps.web.blueprints.readability_tool', 'readability_bp'),
            BlueprintSpec('apps.web.blueprints.gsc_tool', 'gsc_bp'),
            BlueprintSpec('apps.web.blueprints.checklist_tool', 'checklist_bp'),
            BlueprintSpec('apps.web.blueprints.nlp_tool', 'nlp_bp'),
            BlueprintSpec('apps.web.blueprints.eeat_tool', 'eeat_bp'),
            BlueprintSpec('apps.web.blueprints.link_graph', 'graph_bp'),
            BlueprintSpec('apps.web.blueprints.structure_tool', 'structure_bp'),
            BlueprintSpec('apps.web.blueprints.link_opps', 'opps_bp'),
            BlueprintSpec('apps.web.blueprints.intent_tool', 'intent_bp'),
            BlueprintSpec('apps.web.blueprints.wpo_tool', 'wpo_bp'),
            BlueprintSpec('apps.web.blueprints.index_tool', 'index_bp'),
            BlueprintSpec('apps.web.blueprints.redirect_tool', 'redirect_bp'),
            BlueprintSpec('apps.web.blueprints.local_tool', 'local_bp'),
            BlueprintSpec('apps.web.blueprints.prominence_tool', 'prominence_bp'),
            BlueprintSpec('apps.web.blueprints.diff_tool', 'diff_bp'),
            BlueprintSpec('apps.web.blueprints.suggest_tool', 'suggest_bp'),
            BlueprintSpec('apps.web.blueprints.link_health', 'health_bp'),
            BlueprintSpec('apps.web.blueprints.meta_gen', 'meta_gen_bp'),
            BlueprintSpec('apps.web.blueprints.image_audit', 'image_bp'),
            BlueprintSpec('apps.web.blueprints.bot_sim', 'bot_bp'),
            BlueprintSpec('apps.web.blueprints.hreflang_tool', 'hreflang_bp'),
            BlueprintSpec('apps.web.blueprints.content_extract', 'extract_bp'),
            BlueprintSpec('apps.web.blueprints.social_tool', 'social_bp'),
            BlueprintSpec('apps.web.blueprints.schema_tool', 'schema_bp'),
            BlueprintSpec('apps.web.blueprints.robots_tool', 'robots_bp'),
            BlueprintSpec('apps.web.blueprints.decay_tool', 'decay_bp'),
            BlueprintSpec('apps.web.blueprints.index_checker', 'indexer_bp'),
            BlueprintSpec('apps.web.blueprints.headers_tool', 'headers_bp'),
            BlueprintSpec('apps.web.blueprints.duplicate_tool', 'duplicate_bp'),
            BlueprintSpec('apps.web.blueprints.overlap_tool', 'overlap_bp'),
            BlueprintSpec('apps.web.blueprints.seo_tfidf', 'seo_tfidf_bp'),
            BlueprintSpec('apps.web.blueprints.seo_tfidf', 'seo_tfidf_v1_bp'),
        ),
        namespaced=(
            BlueprintSpec('apps.web.blueprints.project_api', 'project_api_bp'),
            BlueprintSpec('apps.web.blueprints.project_manager', 'project_bp'),
        ),
        notes=(
            'project_manager debe registrarse antes de project_api por contexto compartido.',
        ),
    ),
    DomainBootstrap(
        domain='tools',
        core=(
            BlueprintSpec('apps.web.blueprints.tools_extra', 'extra_bp'),
            BlueprintSpec('apps.web.blueprints.migration_tool', 'migration_bp'),
            BlueprintSpec('apps.web.blueprints.leads_tool', 'leads_bp'),
            BlueprintSpec('apps.web.blueprints.dorks_tool', 'dorks_bp'),
            BlueprintSpec('apps.web.blueprints.status_fast', 'fast_bp'),
            BlueprintSpec('apps.web.blueprints.tech_detector', 'tech_bp'),
            BlueprintSpec('apps.web.blueprints.ratio_tool', 'ratio_bp'),
            BlueprintSpec('apps.web.blueprints.sculpting_tool', 'sculpting_bp'),
            BlueprintSpec('apps.web.blueprints.draft_tool', 'draft_bp'),
            BlueprintSpec('apps.web.blueprints.pixel_tool', 'pixel_bp'),
            BlueprintSpec('apps.web.blueprints.anchor_tool', 'anchor_bp'),
            BlueprintSpec('apps.web.blueprints.crawler_tool', 'crawler_bp'),
            BlueprintSpec('apps.web.blueprints.kw_intent', 'kw_intent_bp'),
            BlueprintSpec('apps.web.blueprints.depth_tool', 'depth_bp'),
            BlueprintSpec('apps.web.blueprints.utm_tool', 'utm_bp'),
            BlueprintSpec('apps.web.blueprints.log_tool', 'log_bp'),
            BlueprintSpec('apps.web.blueprints.ctr_tool', 'ctr_bp'),
            BlueprintSpec('apps.web.blueprints.roi_tool', 'roi_bp'),
            BlueprintSpec('apps.web.blueprints.local_nap', 'nap_bp'),
            BlueprintSpec('apps.web.blueprints.expired_tool', 'expired_bp'),
            BlueprintSpec('apps.web.blueprints.benchmark_tool', 'benchmark_bp'),
            BlueprintSpec('apps.web.blueprints.usage_tracker', 'usage_bp'),
            BlueprintSpec('apps.web.blueprints.ops_cleaner', 'cleaner_bp'),
            BlueprintSpec('apps.web.blueprints.ops_frameworks', 'frameworks_bp'),
            BlueprintSpec('apps.web.blueprints.trends_economy', 'trends_bp'),
            BlueprintSpec('apps.web.blueprints.workflow_tool', 'workflow_bp'),
        ),
        namespaced=(),
        notes=(),
    ),
    DomainBootstrap(
        domain='engine',
        core=(
            BlueprintSpec('apps.web.blueprints.api_engine', 'api_engine_bp'),
        ),
        namespaced=(
            BlueprintSpec('apps.web.blueprints.api_engine', 'api_engine_bp'),
        ),
        notes=(),
    ),
)


def _resolve_blueprint(spec: BlueprintSpec):
    module = import_module(spec.module_path)
    return getattr(module, spec.blueprint_attr)


def _iter_core_specs() -> Iterable[BlueprintSpec]:
    for group in DOMAIN_BOOTSTRAP:
        for spec in group.core:
            yield spec


def register_core_blueprints(app: Flask) -> None:
    """Register all legacy/core blueprints from the declarative bootstrap registry."""
    registered: set[Tuple[str, str]] = set()
    for spec in _iter_core_specs():
        key = (spec.module_path, spec.blueprint_attr)
        if key in registered:
            continue
        app.register_blueprint(_resolve_blueprint(spec))
        registered.add(key)


def register_domain_blueprints(app: Flask) -> None:
    """Register domain-scoped aliases with `/api/v1/<domain>` prefixes."""
    for group in DOMAIN_BOOTSTRAP:
        domain_prefix = DOMAIN_PREFIXES[group.domain]
        for spec in group.namespaced:
            blueprint = _resolve_blueprint(spec)
            app.register_blueprint(
                blueprint,
                name=f"{blueprint.name}_{group.domain.replace('-', '_')}_v1",
                url_prefix=domain_prefix,
            )

"""Traceability map for legacy tool routes and their `/api/v1` equivalents."""

API_V1_PREFIX = '/api/v1'

LEGACY_TOOL_ROUTES = [
    '/ai/config',
    '/ai/preference',
    '/anchor/analyze',
    '/audit/download_report',
    '/audit/scan',
    '/autopilot/history',
    '/autopilot/start',
    '/autopilot/status',
    '/benchmark/run',
    '/bot_sim/analyze',
    '/checklist/download',
    '/checklist/run',
    '/cleaner/process',
    '/crawler/download_xml',
    '/crawler/run',
    '/ctr/analyze',
    '/decay/analyze',
    '/depth/run',
    '/diff/compare',
    '/dorks/generate',
    '/draft/analyze',
    '/duplicate/compare',
    '/eeat/analyze_bulk',
    '/entities/analyze',
    '/expired/scan',
    '/extra/generate_faq_schema',
    '/extract/run',
    '/fast/run',
    '/gap/analyze',
    '/gap/download',
    '/graph/build',
    '/headers/analyze',
    '/health/scan',
    '/hreflang/analyze',
    '/image_audit/download',
    '/image_audit/scan',
    '/index_guard/analyze',
    '/indexer/check',
    '/intent/analyze',
    '/kw_intent/classify',
    '/kw_intent/download',
    '/leads/hunt',
    '/local/generate',
    '/log/analyze',
    '/log/download',
    '/meta_gen/download',
    '/meta_gen/run',
    '/migration/generate_redirects',
    '/migration/slugify_bulk',
    '/nap/check',
    '/nlp/analyze_bulk',
    '/opps/scan',
    '/overlap/analyze',
    '/pixel/analyze',
    '/prominence/analyze',
    '/ratio/analyze',
    '/readability/analyze',
    '/redirect/analyze',
    '/robots/check',
    '/roi/calculate',
    '/schema_detector/download',
    '/schema_detector/run',
    '/schema_tool/download',
    '/schema_tool/scan',
    '/sculpting/analyze',
    '/snippet/check',
    '/social/analyze',
    '/structure/analyze',
    '/suggest/mine',
    '/tech/analyze',
    '/trends/start',
    '/usage/stats',
    '/utm/generate',
    '/workflow/data',
    '/wpo/analyze',
]

LEGACY_TO_V1_ROUTES = {
    route: f'{API_V1_PREFIX}{route}'
    for route in LEGACY_TOOL_ROUTES
}

TOOLS_CATALOG = [
    {
        'id': 'workflow-master',
        'name': 'Workflow Maestro',
        'path': '/workflow/master',
        'status': 'migrada',
        'description': 'Flujo orquestado con priorización de tareas SEO.',
    },
    {
        'id': 'gsc-tracker',
        'name': 'GSC Tracker',
        'path': '/gsc/dashboard',
        'status': 'beta',
        'description': 'Monitoreo de Search Console y alertas operativas.',
    },
    {
        'id': 'eco-trends',
        'name': 'EcoTrends Realtime',
        'path': '/trends/media',
        'status': 'beta',
        'description': 'Detección de tendencias y briefing editorial.',
    },
    {
        'id': 'audit-suite',
        'name': 'Audit Suite',
        'path': '/audit',
        'status': 'legacy',
        'description': 'Diagnóstico técnico clásico para auditorías masivas.',
    },
    {
        'id': 'crawler-suite',
        'name': 'Crawler',
        'path': '/crawler',
        'status': 'legacy',
        'description': 'Rastreo y exportación XML del inventario de URLs.',
    },
    {
        'id': 'keyword-gap',
        'name': 'Keyword Gap',
        'path': '/gap',
        'status': 'migrada',
        'description': 'Comparativa de brechas semánticas vs competencia.',
    },
    {
        'id': 'schema-tool',
        'name': 'Schema Tool',
        'path': '/schema_tool',
        'status': 'legacy',
        'description': 'Validación y exportación de marcado estructurado.',
    },
    {
        'id': 'operator-console',
        'name': 'Operator Console',
        'path': '/operator',
        'status': 'migrada',
        'description': 'Consola para ejecución manual de tareas internas.',
    },
]

LEGACY_PREFIX_MAPPINGS = (
    ('/api/seo/tfidf/projects', f'{API_V1_PREFIX}/seo/tfidf/projects'),
    ('/api/seo/tfidf/projects/', f'{API_V1_PREFIX}/seo/tfidf/projects/'),
    ('/api/seo/tfidf/runs/', f'{API_V1_PREFIX}/seo/tfidf/runs/'),
)


def should_redirect_legacy_path(path: str) -> bool:
    """Return True when a legacy tool endpoint should redirect to `/api/v1`."""
    if path in LEGACY_TO_V1_ROUTES:
        return True
    return any(path.startswith(prefix) for prefix, _ in LEGACY_PREFIX_MAPPINGS)


def map_legacy_path_to_v1(path: str) -> str:
    """Map a legacy route path to its `/api/v1` equivalent."""
    if path in LEGACY_TO_V1_ROUTES:
        return LEGACY_TO_V1_ROUTES[path]

    for legacy_prefix, v1_prefix in LEGACY_PREFIX_MAPPINGS:
        if path.startswith(legacy_prefix):
            return path.replace(legacy_prefix, v1_prefix, 1)

    return path

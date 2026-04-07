from typing import Dict, Tuple

DOMAIN_TAXONOMY: Tuple[str, ...] = (
    'client-management',
    'seo-engine',
    'portal-auth',
    'legacy-tools',
)

DOMAIN_PREFIXES: Dict[str, str] = {
    'client-management': '/api/v1/client-management',
    'seo-engine': '/api/v1/seo-engine',
    'portal-auth': '/api/v1/portal-auth',
    'legacy-tools': '/api/v1/legacy-tools',
}

from typing import Dict, Tuple

DOMAIN_TAXONOMY: Tuple[str, ...] = (
    'portal',
    'ai',
    'seo-core',
    'tools',
    'engine',
)

DOMAIN_PREFIXES: Dict[str, str] = {
    domain: f'/api/v1/{domain}' for domain in DOMAIN_TAXONOMY
}

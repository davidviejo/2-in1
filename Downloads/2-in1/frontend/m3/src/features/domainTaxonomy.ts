export const DOMAIN_TAXONOMY = [
  'client-management',
  'seo-engine',
  'portal-auth',
  'legacy-tools',
] as const;

export type ProductDomain = (typeof DOMAIN_TAXONOMY)[number];

export const DOMAIN_OWNERSHIP: Record<ProductDomain, string> = {
  'client-management': 'Team Client Core',
  'seo-engine': 'Team SEO Intelligence',
  'portal-auth': 'Team Platform Identity',
  'legacy-tools': 'Team SEO Ops Legacy',
};

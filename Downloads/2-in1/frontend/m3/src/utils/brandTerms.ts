export const parseBrandTerms = (value: string): string[] =>
  value
    .split(/\r?\n|,|;/)
    .map((term) => term.trim())
    .filter(Boolean);

export const normalizeBrandTerm = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const isBrandTermMatch = (keyword: string, brandTerms: string[] = []) => {
  const normalizedKeyword = normalizeBrandTerm(keyword);
  if (!normalizedKeyword) return false;

  return brandTerms.some((term) => {
    const normalizedTerm = normalizeBrandTerm(term);
    if (!normalizedTerm) return false;

    const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(normalizedTerm)}([^a-z0-9]|$)`);
    return pattern.test(normalizedKeyword);
  });
};

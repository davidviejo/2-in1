import { SeoPage } from '../types/seoChecklist';

const HTTP_PROTOCOL_RE = /^https?:\/\//i;

export const normalizeSeoUrl = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const withProtocol = HTTP_PROTOCOL_RE.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    const normalizedPath = parsed.pathname !== '/' ? parsed.pathname.replace(/\/+$/, '') || '/' : '/';
    return `${parsed.protocol}//${parsed.host}${normalizedPath}${parsed.search}${parsed.hash}`;
  } catch {
    return withProtocol;
  }
};

export const buildSeoUrlCanonicalKey = (value: string): string => {
  const normalized = normalizeSeoUrl(value).trim();
  if (!normalized) return '';

  try {
    const parsed = new URL(normalized);
    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
    const pathname = parsed.pathname.toLowerCase();
    const path = pathname !== '/' ? pathname.replace(/\/+$/, '') || '/' : '/';
    return `${host}${path}${parsed.search}`;
  } catch {
    return normalized.toLowerCase().replace(/\/+$/, '');
  }
};

export const normalizeSeoPageInput = <T extends Pick<SeoPage, 'url'>>(pageLike: T): T => ({
  ...pageLike,
  url: normalizeSeoUrl(pageLike.url),
});

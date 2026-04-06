import { SeoPage } from '../types/seoChecklist';

const HTTP_PROTOCOL_RE = /^https?:\/\//i;

export const normalizeSeoUrl = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  if (HTTP_PROTOCOL_RE.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
};

export const normalizeSeoPageInput = <T extends Pick<SeoPage, 'url'>>(pageLike: T): T => ({
  ...pageLike,
  url: normalizeSeoUrl(pageLike.url),
});

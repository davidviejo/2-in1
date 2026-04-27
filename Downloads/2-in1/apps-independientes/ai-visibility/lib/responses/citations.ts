export type CitationSourceType = 'owned' | 'competitor' | 'directory' | 'social' | 'ugc' | 'media' | 'other';

export type NormalizedCitation = {
  domain: string | null;
  host: string | null;
  url: string | null;
  rootDomain: string | null;
  isClientDomain: boolean;
  isCompetitorDomain: boolean;
  sourceType: CitationSourceType;
};

export type CitationGrouping = 'domain' | 'host' | 'page';

export type CitationGroup = {
  key: string;
  citations: NormalizedCitation[];
};

export type ExtractCitationsInput = {
  responseText: string;
  rawSources?: unknown;
  clientDomains?: string[];
  competitorDomains?: string[];
};

type CitationCandidate = {
  url?: string;
  host?: string;
  domain?: string;
};

const URL_PATTERN = /\b((?:https?:\/\/|www\.)[^\s<>()]+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>()]*)?)/gi;

const TRAILING_PUNCTUATION = /[),.;:!?\]\}]+$/;
const LEADING_PUNCTUATION = /^[({\[]+/;

const SOCIAL_DOMAINS = new Set([
  'facebook.com',
  'instagram.com',
  'linkedin.com',
  'twitter.com',
  'x.com',
  'tiktok.com',
  'youtube.com',
  'pinterest.com'
]);

const DIRECTORY_DOMAINS = new Set([
  'yelp.com',
  'yellowpages.com',
  'tripadvisor.com',
  'bbb.org',
  'angi.com',
  'g2.com',
  'capterra.com',
  'clutch.co'
]);

const UGC_DOMAINS = new Set(['reddit.com', 'quora.com', 'stackoverflow.com', 'stackexchange.com', 'medium.com']);

const MEDIA_DOMAINS = new Set(['wikipedia.org', 'nytimes.com', 'forbes.com', 'reuters.com', 'bbc.com', 'cnn.com']);

const COMPOUND_PUBLIC_SUFFIXES = new Set([
  'co.uk',
  'org.uk',
  'ac.uk',
  'gov.uk',
  'com.au',
  'net.au',
  'org.au',
  'co.nz',
  'com.br',
  'com.mx',
  'co.jp'
]);

function cleanupToken(input: string): string {
  return input.replace(LEADING_PUNCTUATION, '').replace(TRAILING_PUNCTUATION, '').trim();
}

function extractHostFromUrlish(value: string): string | null {
  const token = cleanupToken(value);

  if (!token) {
    return null;
  }

  const withProtocol = /^[a-z]+:\/\//i.test(token) ? token : `https://${token}`;

  try {
    const parsed = new URL(withProtocol);
    return parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function normalizeHost(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const host = extractHostFromUrlish(value);

  if (!host) {
    return null;
  }

  return host.replace(/^www\./, '');
}

export function normalizeRootDomain(value: string | null | undefined): string | null {
  const host = normalizeHost(value);

  if (!host) {
    return null;
  }

  const labels = host.split('.').filter(Boolean);
  if (labels.length < 2) {
    return host;
  }

  const tail2 = `${labels[labels.length - 2]}.${labels[labels.length - 1]}`;

  if (labels.length >= 3 && COMPOUND_PUBLIC_SUFFIXES.has(tail2)) {
    return `${labels[labels.length - 3]}.${tail2}`;
  }

  return tail2;
}

function normalizeUrl(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const token = cleanupToken(value);
  const withProtocol = /^[a-z]+:\/\//i.test(token) ? token : `https://${token}`;

  try {
    const parsed = new URL(withProtocol);
    parsed.hash = '';
    if ((parsed.protocol === 'https:' && parsed.port === '443') || (parsed.protocol === 'http:' && parsed.port === '80')) {
      parsed.port = '';
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function collectTextCandidates(responseText: string): CitationCandidate[] {
  const candidates: CitationCandidate[] = [];
  for (const match of responseText.matchAll(URL_PATTERN)) {
    const token = match[1];
    if (!token) {
      continue;
    }

    candidates.push({ url: cleanupToken(token) });
  }

  return candidates;
}

function collectStructuredCandidates(rawSources: unknown): CitationCandidate[] {
  if (!rawSources || typeof rawSources !== 'object') {
    return [];
  }

  const out: CitationCandidate[] = [];
  const queue: unknown[] = [rawSources];

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current || typeof current !== 'object') {
      continue;
    }

    if (Array.isArray(current)) {
      for (const item of current) {
        queue.push(item);
      }
      continue;
    }

    const record = current as Record<string, unknown>;
    const url = typeof record.url === 'string' ? record.url : typeof record.href === 'string' ? record.href : typeof record.sourceUrl === 'string' ? record.sourceUrl : undefined;
    const host = typeof record.host === 'string' ? record.host : undefined;
    const domain = typeof record.domain === 'string' ? record.domain : typeof record.sourceDomain === 'string' ? record.sourceDomain : undefined;

    if (url || host || domain) {
      out.push({ url, host, domain });
    }

    for (const value of Object.values(record)) {
      if (value && typeof value === 'object') {
        queue.push(value);
      }
    }
  }

  return out;
}

function guessSourceType(rootDomain: string | null, isClientDomain: boolean, isCompetitorDomain: boolean): CitationSourceType {
  if (isClientDomain) {
    return 'owned';
  }

  if (isCompetitorDomain) {
    return 'competitor';
  }

  if (!rootDomain) {
    return 'other';
  }

  if (DIRECTORY_DOMAINS.has(rootDomain)) {
    return 'directory';
  }

  if (SOCIAL_DOMAINS.has(rootDomain)) {
    return 'social';
  }

  if (UGC_DOMAINS.has(rootDomain)) {
    return 'ugc';
  }

  if (MEDIA_DOMAINS.has(rootDomain)) {
    return 'media';
  }

  return 'other';
}

export function classifyCitationSource(input: {
  rootDomain: string | null;
  isClientDomain: boolean;
  isCompetitorDomain: boolean;
}): CitationSourceType {
  return guessSourceType(input.rootDomain, input.isClientDomain, input.isCompetitorDomain);
}

export function extractAndNormalizeCitations(input: ExtractCitationsInput): NormalizedCitation[] {
  const clientRootDomains = new Set((input.clientDomains ?? []).map((domain) => normalizeRootDomain(domain)).filter((value): value is string => Boolean(value)));
  const competitorRootDomains = new Set((input.competitorDomains ?? []).map((domain) => normalizeRootDomain(domain)).filter((value): value is string => Boolean(value)));

  const candidates = [...collectTextCandidates(input.responseText), ...collectStructuredCandidates(input.rawSources)];

  const results: NormalizedCitation[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const normalizedUrl = normalizeUrl(candidate.url);
    const host = normalizeHost(candidate.host ?? candidate.domain ?? candidate.url ?? null);
    const domain = normalizeRootDomain(candidate.domain ?? candidate.host ?? candidate.url ?? null);
    const rootDomain = domain;

    if (!host && !domain && !normalizedUrl) {
      continue;
    }

    const dedupeKey = normalizedUrl ?? `${host ?? ''}|${domain ?? ''}`;

    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);

    const isClientDomain = rootDomain ? clientRootDomains.has(rootDomain) : false;
    const isCompetitorDomain = rootDomain ? competitorRootDomains.has(rootDomain) : false;

    results.push({
      domain,
      host,
      url: normalizedUrl,
      rootDomain,
      isClientDomain,
      isCompetitorDomain,
      sourceType: guessSourceType(rootDomain, isClientDomain, isCompetitorDomain)
    });
  }

  return results;
}

export function groupCitations(citations: NormalizedCitation[], by: CitationGrouping): CitationGroup[] {
  const grouped = new Map<string, NormalizedCitation[]>();

  for (const citation of citations) {
    const key =
      by === 'page'
        ? citation.url ?? '(unknown)'
        : by === 'host'
          ? citation.host ?? '(unknown)'
          : citation.domain ?? '(unknown)';

    const current = grouped.get(key);
    if (current) {
      current.push(citation);
    } else {
      grouped.set(key, [citation]);
    }
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, entries]) => ({ key, citations: entries }));
}

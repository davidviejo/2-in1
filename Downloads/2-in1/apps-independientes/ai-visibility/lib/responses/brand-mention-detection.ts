const NON_ALPHANUMERIC = /[^a-z0-9]+/g;

export type MentionType = 'exact' | 'alias' | 'domain_only' | 'implicit' | 'none';

export type CompetitorInput = {
  name: string;
  domain?: string | null;
  aliases?: string[];
};

export type BrandMentionDetectionInput = {
  responseText: string;
  client: {
    primaryDomain: string;
    aliases?: string[];
  };
  competitors: CompetitorInput[];
};

export type CompetitorMention = {
  competitorName: string;
  mentionType: Exclude<MentionType, 'implicit' | 'none'>;
  matchedTerm: string;
  atIndex: number;
};

export type BrandMentionDetectionResult = {
  clientMentioned: boolean;
  mentionType: MentionType;
  competitorMentions: CompetitorMention[];
};

type SearchTerm = {
  raw: string;
  normalized: string;
};

function stripProtocolAndPath(value: string): string {
  const withoutProtocol = value.trim().toLowerCase().replace(/^https?:\/\//, '');
  return withoutProtocol.replace(/^www\./, '').split('/')[0].split('?')[0].split('#')[0];
}

function normalizeDomain(value: string): string {
  return stripProtocolAndPath(value).replace(/\.+$/, '');
}

function domainRootLabel(domain: string): string {
  const host = normalizeDomain(domain);
  const [label = ''] = host.split('.');
  return normalizePhrase(label);
}

function normalizePhrase(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(NON_ALPHANUMERIC, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function phraseToRegex(phrase: string): RegExp {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i');
}

function findPhraseIndex(haystack: string, phrase: string): number {
  if (!phrase) {
    return -1;
  }

  const regex = phraseToRegex(phrase);
  const match = regex.exec(haystack);
  return match ? match.index : -1;
}

const COMMON_TLDS = new Set([
  'com',
  'io',
  'org',
  'net',
  'co',
  'ai',
  'app',
  'dev',
  'tech',
  'es',
  'mx',
  'us',
  'uk'
]);

function findRootExactIndex(haystack: string, root: string): number {
  if (!root) {
    return -1;
  }

  const tokens = haystack.split(' ');
  const rootTokens = root.split(' ');

  for (let i = 0; i <= tokens.length - rootTokens.length; i += 1) {
    const isMatch = rootTokens.every((token, offset) => tokens[i + offset] === token);
    if (!isMatch) {
      continue;
    }

    const nextToken = tokens[i + rootTokens.length] ?? '';
    if (COMMON_TLDS.has(nextToken)) {
      continue;
    }

    const prefix = tokens.slice(0, i).join(' ');
    return prefix.length > 0 ? prefix.length + 1 : 0;
  }

  return -1;
}

function buildTerms(values: string[] | undefined): SearchTerm[] {
  if (!values || values.length === 0) {
    return [];
  }

  const byNormalized = new Map<string, SearchTerm>();
  for (const value of values) {
    const normalized = normalizePhrase(value);
    if (!normalized) {
      continue;
    }

    if (!byNormalized.has(normalized)) {
      byNormalized.set(normalized, { raw: value.trim(), normalized });
    }
  }

  return Array.from(byNormalized.values());
}

function hasImplicitClientSignal(normalizedText: string): boolean {
  const patterns = [
    /\byour\s+(brand|company|business|website|domain|platform)\b/i,
    /\bthe\s+client\b/i,
    /\bthe\s+brand\s+(website|domain)\b/i,
    /\bofficial\s+(website|site)\b/i
  ];

  return patterns.some((pattern) => pattern.test(normalizedText));
}

export function detectBrandMentions(input: BrandMentionDetectionInput): BrandMentionDetectionResult {
  const normalizedText = normalizePhrase(input.responseText);
  const clientDomain = normalizeDomain(input.client.primaryDomain);
  const clientDomainTerm = normalizePhrase(clientDomain);
  const clientExactTerm = domainRootLabel(clientDomain);
  const clientAliases = buildTerms(input.client.aliases);

  const competitorAliasUniverse = new Set<string>();
  for (const competitor of input.competitors) {
    buildTerms([competitor.name, ...(competitor.aliases ?? [])]).forEach((alias) => {
      competitorAliasUniverse.add(alias.normalized);
    });
  }

  const sharedAliases = new Set<string>(
    clientAliases.filter((alias) => competitorAliasUniverse.has(alias.normalized)).map((alias) => alias.normalized)
  );

  const clientExactIndex = findRootExactIndex(normalizedText, clientExactTerm);
  const clientAliasMatch = clientAliases
    .filter((alias) => !sharedAliases.has(alias.normalized))
    .map((alias) => ({ alias, index: findPhraseIndex(normalizedText, alias.normalized) }))
    .filter((entry) => entry.index >= 0)
    .sort((a, b) => a.index - b.index || b.alias.normalized.length - a.alias.normalized.length)[0];

  const clientDomainIndex = findPhraseIndex(normalizedText, clientDomainTerm);

  let mentionType: MentionType = 'none';
  if (clientAliasMatch && (clientExactIndex < 0 || clientAliasMatch.alias.normalized.length > clientExactTerm.length)) {
    mentionType = 'alias';
  } else if (clientExactTerm && clientExactIndex >= 0) {
    mentionType = 'exact';
  } else if (clientDomainIndex >= 0) {
    mentionType = 'domain_only';
  } else if (hasImplicitClientSignal(normalizedText)) {
    mentionType = 'implicit';
  }

  const competitorMentions: CompetitorMention[] = input.competitors
    .map((competitor) => {
      const aliasTerms = buildTerms([competitor.name, ...(competitor.aliases ?? [])]);
      const domain = competitor.domain ? normalizeDomain(competitor.domain) : '';
      const domainTerm = normalizePhrase(domain);
      const exactTerm = domain ? domainRootLabel(domain) : '';

      const exactIndex = exactTerm ? findRootExactIndex(normalizedText, exactTerm) : -1;
      const aliasHit = aliasTerms
        .filter((alias) => !sharedAliases.has(alias.normalized))
        .map((alias) => ({ alias, index: findPhraseIndex(normalizedText, alias.normalized) }))
        .filter((entry) => entry.index >= 0)
        .sort((a, b) => a.index - b.index || b.alias.normalized.length - a.alias.normalized.length)[0];
      const domainIndex = domainTerm ? findPhraseIndex(normalizedText, domainTerm) : -1;

      if (exactIndex >= 0) {
        return {
          competitorName: competitor.name,
          mentionType: 'exact' as const,
          matchedTerm: exactTerm,
          atIndex: exactIndex
        };
      }

      if (aliasHit) {
        return {
          competitorName: competitor.name,
          mentionType: 'alias' as const,
          matchedTerm: aliasHit.alias.normalized,
          atIndex: aliasHit.index
        };
      }

      if (domainIndex >= 0) {
        return {
          competitorName: competitor.name,
          mentionType: 'domain_only' as const,
          matchedTerm: domainTerm,
          atIndex: domainIndex
        };
      }

      return null;
    })
    .filter((value): value is CompetitorMention => Boolean(value))
    .sort((a, b) => a.atIndex - b.atIndex || a.competitorName.localeCompare(b.competitorName));

  return {
    clientMentioned: mentionType !== 'none',
    mentionType,
    competitorMentions
  };
}

export const brandMentionDetectionNotes = {
  normalization: [
    'Lowercase conversion and unicode diacritic folding (NFKD).',
    'All non-alphanumeric symbols collapse into spaces.',
    'Consecutive spaces collapse into one to keep token boundaries deterministic.',
    'Domains are normalized by removing protocol, www prefix, paths, query strings and trailing dots.'
  ],
  falsePositiveRisks: [
    'Single-word aliases that are common dictionary words can still match in non-brand contexts.',
    'Root-label exact matching (e.g. "apple" from apple.com) can collide with generic usage.',
    'Implicit detection relies on a short pattern list and may miss indirect references.'
  ],
  edgeCases: [
    'Shared aliases between client and competitors are considered ambiguous and ignored for both sides unless a domain match exists.',
    'Hyphen/underscore differences are normalized, so "acme-ai" equals "acme ai".',
    'Subdomain/path mentions are treated as domain mentions after host normalization.'
  ]
} as const;

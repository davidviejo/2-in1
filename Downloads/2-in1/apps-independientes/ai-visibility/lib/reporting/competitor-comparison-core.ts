import { normalizeRootDomain } from '@/lib/responses/citations';

type ProjectComparisonBrand = {
  key: string;
  type: 'CLIENT' | 'COMPETITOR';
  id: string | null;
  name: string;
  domain: string;
  rootDomain: string | null;
};

type PromptRecord = {
  id: string;
  title: string;
};

type RunRecord = {
  id: string;
  promptId: string;
  status: string;
};

type ResponseRecord = {
  id: string;
  runId: string;
  status: string;
  sentiment: string | null;
};

type MentionRecord = {
  responseId: string;
  mentionType: 'OWN_BRAND' | 'COMPETITOR';
  competitorId: string | null;
  mentionCount: number;
};

type CitationRecord = {
  responseId: string;
  sourceDomain: string;
};

export type CompetitorComparisonInput = {
  clientBrandName: string;
  clientDomain: string;
  competitors: Array<{ id: string; name: string; domain: string }>;
  prompts: PromptRecord[];
  runs: RunRecord[];
  responses: ResponseRecord[];
  mentions: MentionRecord[];
  citations: CitationRecord[];
};

type SentimentBuckets = {
  positive: { count: number; share: number | null };
  neutral: { count: number; share: number | null };
  negative: { count: number; share: number | null };
  other: { count: number; share: number | null };
};

export type CompetitorComparisonResult = {
  comparisonSet: Array<{
    brandKey: string;
    brandType: 'CLIENT' | 'COMPETITOR';
    brandId: string | null;
    brandName: string;
    domain: string;
  }>;
  mentionShareByBrand: Array<{
    brandKey: string;
    brandName: string;
    brandType: 'CLIENT' | 'COMPETITOR';
    mentionCount: number;
    share: number | null;
  }>;
  citationShareByBrand: {
    denominator: number;
    unmatchedCitationCount: number;
    rows: Array<{
      brandKey: string;
      brandName: string;
      brandType: 'CLIENT' | 'COMPETITOR';
      citationCount: number;
      share: number | null;
      domains: Array<{ domain: string; citations: number; shareWithinBrand: number | null }>;
    }>;
  };
  sentimentSummaryByBrand: Array<{
    brandKey: string;
    brandName: string;
    brandType: 'CLIENT' | 'COMPETITOR';
    denominator: number;
    buckets: SentimentBuckets;
  }>;
  competitorPromptInsights: Array<{
    competitorId: string;
    competitorName: string;
    strongestPrompt: {
      promptId: string;
      title: string;
      responseCount: number;
      clientMentionedResponses: number;
      competitorMentionedResponses: number;
      netAdvantage: number;
    } | null;
    weakestPrompt: {
      promptId: string;
      title: string;
      responseCount: number;
      clientMentionedResponses: number;
      competitorMentionedResponses: number;
      netAdvantage: number;
    } | null;
  }>;
};

function safeRate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) {
    return null;
  }

  return numerator / denominator;
}

function toSentimentBucket(value: string | null): keyof SentimentBuckets {
  const normalized = (value ?? '').trim().toLowerCase();

  if (normalized === 'positive' || normalized === 'neutral' || normalized === 'negative') {
    return normalized;
  }

  return 'other';
}

function makeEmptySentimentBuckets(): SentimentBuckets {
  return {
    positive: { count: 0, share: null },
    neutral: { count: 0, share: null },
    negative: { count: 0, share: null },
    other: { count: 0, share: null }
  };
}

export function buildCompetitorComparison(input: CompetitorComparisonInput): CompetitorComparisonResult {
  const comparisonBrands: ProjectComparisonBrand[] = [
    {
      key: 'client',
      type: 'CLIENT',
      id: null,
      name: input.clientBrandName,
      domain: input.clientDomain,
      rootDomain: normalizeRootDomain(input.clientDomain)
    },
    ...input.competitors.map((competitor) => ({
      key: `competitor:${competitor.id}`,
      type: 'COMPETITOR' as const,
      id: competitor.id,
      name: competitor.name,
      domain: competitor.domain,
      rootDomain: normalizeRootDomain(competitor.domain)
    }))
  ];

  const competitorIds = new Set(input.competitors.map((competitor) => competitor.id));

  const mentionCountByBrand = new Map<string, number>(comparisonBrands.map((brand) => [brand.key, 0]));
  const mentionedResponseIdsByBrand = new Map<string, Set<string>>(comparisonBrands.map((brand) => [brand.key, new Set<string>()]));

  const runById = new Map(input.runs.map((run) => [run.id, run]));
  const responseById = new Map(input.responses.map((response) => [response.id, response]));

  const validResponseIds = new Set(
    input.responses.filter((response) => response.status === 'SUCCEEDED' && runById.get(response.runId)?.status === 'SUCCEEDED').map((response) => response.id)
  );

  const responseIdsByPrompt = new Map<string, Set<string>>();
  for (const response of input.responses) {
    if (!validResponseIds.has(response.id)) {
      continue;
    }

    const promptId = runById.get(response.runId)?.promptId;
    if (!promptId) {
      continue;
    }

    const current = responseIdsByPrompt.get(promptId) ?? new Set<string>();
    current.add(response.id);
    responseIdsByPrompt.set(promptId, current);
  }

  for (const mention of input.mentions) {
    if (!validResponseIds.has(mention.responseId) || mention.mentionCount <= 0) {
      continue;
    }

    if (mention.mentionType === 'OWN_BRAND') {
      mentionCountByBrand.set('client', (mentionCountByBrand.get('client') ?? 0) + mention.mentionCount);
      mentionedResponseIdsByBrand.get('client')?.add(mention.responseId);
      continue;
    }

    if (mention.mentionType === 'COMPETITOR' && mention.competitorId && competitorIds.has(mention.competitorId)) {
      const key = `competitor:${mention.competitorId}`;
      mentionCountByBrand.set(key, (mentionCountByBrand.get(key) ?? 0) + mention.mentionCount);
      mentionedResponseIdsByBrand.get(key)?.add(mention.responseId);
    }
  }

  const totalMentions = Array.from(mentionCountByBrand.values()).reduce((sum, value) => sum + value, 0);

  const mentionShareByBrand = comparisonBrands.map((brand) => {
    const mentionCount = mentionCountByBrand.get(brand.key) ?? 0;

    return {
      brandKey: brand.key,
      brandName: brand.name,
      brandType: brand.type,
      mentionCount,
      share: safeRate(mentionCount, totalMentions)
    };
  });

  const domainToBrandKey = new Map<string, string>();
  for (const brand of comparisonBrands) {
    if (brand.rootDomain) {
      domainToBrandKey.set(brand.rootDomain, brand.key);
    }
  }

  const citationCountByBrand = new Map<string, number>(comparisonBrands.map((brand) => [brand.key, 0]));
  const citationsByBrandDomain = new Map<string, Map<string, number>>();
  let unmatchedCitationCount = 0;

  for (const citation of input.citations) {
    if (!validResponseIds.has(citation.responseId)) {
      continue;
    }

    const rootDomain = normalizeRootDomain(citation.sourceDomain);
    if (!rootDomain) {
      unmatchedCitationCount += 1;
      continue;
    }

    const brandKey = domainToBrandKey.get(rootDomain);
    if (!brandKey) {
      unmatchedCitationCount += 1;
      continue;
    }

    citationCountByBrand.set(brandKey, (citationCountByBrand.get(brandKey) ?? 0) + 1);
    const perDomain = citationsByBrandDomain.get(brandKey) ?? new Map<string, number>();
    perDomain.set(rootDomain, (perDomain.get(rootDomain) ?? 0) + 1);
    citationsByBrandDomain.set(brandKey, perDomain);
  }

  const matchedCitationDenominator = Array.from(citationCountByBrand.values()).reduce((sum, value) => sum + value, 0);

  const citationShareRows = comparisonBrands.map((brand) => {
    const citationCount = citationCountByBrand.get(brand.key) ?? 0;
    const perDomain = Array.from(citationsByBrandDomain.get(brand.key)?.entries() ?? [])
      .map(([domain, citations]) => ({
        domain,
        citations,
        shareWithinBrand: safeRate(citations, citationCount)
      }))
      .sort((a, b) => b.citations - a.citations || a.domain.localeCompare(b.domain));

    return {
      brandKey: brand.key,
      brandName: brand.name,
      brandType: brand.type,
      citationCount,
      share: safeRate(citationCount, matchedCitationDenominator),
      domains: perDomain
    };
  });

  const sentimentSummaryByBrand = comparisonBrands.map((brand) => {
    const responseIds = mentionedResponseIdsByBrand.get(brand.key) ?? new Set<string>();
    const buckets = makeEmptySentimentBuckets();

    for (const responseId of responseIds) {
      const response = responseById.get(responseId);
      if (!response) {
        continue;
      }

      const bucket = toSentimentBucket(response.sentiment);
      buckets[bucket].count += 1;
    }

    const denominator = responseIds.size;
    for (const value of Object.values(buckets)) {
      value.share = safeRate(value.count, denominator);
    }

    return {
      brandKey: brand.key,
      brandName: brand.name,
      brandType: brand.type,
      denominator,
      buckets
    };
  });

  const competitorPromptInsights = input.competitors.map((competitor) => {
    const competitorKey = `competitor:${competitor.id}`;
    const competitorMentionResponseIds = mentionedResponseIdsByBrand.get(competitorKey) ?? new Set<string>();
    const clientMentionResponseIds = mentionedResponseIdsByBrand.get('client') ?? new Set<string>();

    const scoredPrompts = input.prompts
      .map((prompt) => {
        const promptResponses = responseIdsByPrompt.get(prompt.id) ?? new Set<string>();

        if (promptResponses.size === 0) {
          return null;
        }

        let competitorMentionedResponses = 0;
        let clientMentionedResponses = 0;

        for (const responseId of promptResponses) {
          if (competitorMentionResponseIds.has(responseId)) {
            competitorMentionedResponses += 1;
          }

          if (clientMentionResponseIds.has(responseId)) {
            clientMentionedResponses += 1;
          }
        }

        return {
          promptId: prompt.id,
          title: prompt.title,
          responseCount: promptResponses.size,
          clientMentionedResponses,
          competitorMentionedResponses,
          netAdvantage: clientMentionedResponses - competitorMentionedResponses
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    scoredPrompts.sort((a, b) => {
      if (a.netAdvantage !== b.netAdvantage) {
        return b.netAdvantage - a.netAdvantage;
      }

      if (a.competitorMentionedResponses !== b.competitorMentionedResponses) {
        return a.competitorMentionedResponses - b.competitorMentionedResponses;
      }

      return a.title.localeCompare(b.title);
    });

    return {
      competitorId: competitor.id,
      competitorName: competitor.name,
      strongestPrompt: scoredPrompts[0] ?? null,
      weakestPrompt: scoredPrompts.length > 0 ? scoredPrompts[scoredPrompts.length - 1] : null
    };
  });

  return {
    comparisonSet: comparisonBrands.map((brand) => ({
      brandKey: brand.key,
      brandType: brand.type,
      brandId: brand.id,
      brandName: brand.name,
      domain: brand.domain
    })),
    mentionShareByBrand,
    citationShareByBrand: {
      denominator: matchedCitationDenominator,
      unmatchedCitationCount,
      rows: citationShareRows
    },
    sentimentSummaryByBrand,
    competitorPromptInsights
  };
}

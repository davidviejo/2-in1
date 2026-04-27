import {
  CitationGrouping,
  CitationSourceType,
  classifyCitationSource,
  groupCitations,
  normalizeHost,
  normalizeRootDomain,
  type NormalizedCitation
} from '@/lib/responses/citations';

export type CitationExplorerSortBy = 'count' | 'share';

export type CitationExplorerInputRow = {
  sourceUrl: string;
  sourceDomain: string;
};

export type CitationExplorerGroupRow = {
  key: string;
  count: number;
  share: number;
  isClientDomain: boolean;
  isCompetitorDomain: boolean;
  sourceType: CitationSourceType;
};

export type BuildCitationExplorerGroupsInput = {
  rows: CitationExplorerInputRow[];
  groupBy: CitationGrouping;
  sortBy: CitationExplorerSortBy;
  clientDomains: string[];
  competitorDomains: string[];
};

function toNormalizedCitation(
  row: CitationExplorerInputRow,
  clientRootDomains: Set<string>,
  competitorRootDomains: Set<string>
): NormalizedCitation {
  const rootDomain = normalizeRootDomain(row.sourceDomain || row.sourceUrl);
  const host = normalizeHost(row.sourceUrl || row.sourceDomain);

  const isClientDomain = rootDomain ? clientRootDomains.has(rootDomain) : false;
  const isCompetitorDomain = rootDomain ? competitorRootDomains.has(rootDomain) : false;

  return {
    domain: rootDomain,
    host,
    url: row.sourceUrl,
    rootDomain,
    isClientDomain,
    isCompetitorDomain,
    sourceType: classifyCitationSource({
      rootDomain,
      isClientDomain,
      isCompetitorDomain
    })
  };
}

export function buildCitationExplorerGroups(input: BuildCitationExplorerGroupsInput): {
  total: number;
  groups: CitationExplorerGroupRow[];
} {
  const clientRootDomains = new Set(input.clientDomains.map((domain) => normalizeRootDomain(domain)).filter((value): value is string => Boolean(value)));
  const competitorRootDomains = new Set(input.competitorDomains.map((domain) => normalizeRootDomain(domain)).filter((value): value is string => Boolean(value)));

  const citations = input.rows.map((row) => toNormalizedCitation(row, clientRootDomains, competitorRootDomains));
  const groups = groupCitations(citations, input.groupBy);
  const total = citations.length;

  const rows = groups.map((group): CitationExplorerGroupRow => {
    const count = group.citations.length;
    const firstSourceType = group.citations[0]?.sourceType ?? 'other';

    return {
      key: group.key,
      count,
      share: total > 0 ? count / total : 0,
      isClientDomain: group.citations.some((citation) => citation.isClientDomain),
      isCompetitorDomain: group.citations.some((citation) => citation.isCompetitorDomain),
      sourceType: group.citations.every((citation) => citation.sourceType === firstSourceType) ? firstSourceType : 'other'
    };
  });

  rows.sort((a, b) => {
    const primary = input.sortBy === 'share' ? b.share - a.share : b.count - a.count;
    if (primary !== 0) {
      return primary;
    }

    return a.key.localeCompare(b.key);
  });

  return {
    total,
    groups: rows
  };
}

import { buildProjectCompetitorComparison } from '@/lib/reporting/competitor-comparison';
import { buildProjectSummary } from '@/lib/reporting/summary';
import { getPreviousComparableRange, validateSummaryDateRange } from '@/lib/reporting/summary-validation';
import { normalizeCountry, normalizeLanguage, normalizeSearchTerm, safeTrim } from '@/lib/filters/normalization';
import { listCitations, listResponses } from '@/lib/responses/persistence';
import { prisma } from '@/lib/db';
import type { ExportRequestFilters, ExportTable } from '@/lib/exports/types';

function parseTagIds(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }

  return Array.from(
    new Set(
      raw
        .split(',')
        .map((value) => safeTrim(value))
        .filter(Boolean)
    )
  );
}

function asIsoDate(value: Date | string | null | undefined): string {
  if (!value) {
    return '';
  }

  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString();
}

function summarizeFilters(filters: ExportRequestFilters): string {
  const from = filters.from ?? 'na';
  const to = filters.to ?? 'na';
  return `${from}_${to}`;
}

export async function buildSummaryKpiPackExport(projectId: string, filters: ExportRequestFilters): Promise<ExportTable> {
  const validation = validateSummaryDateRange(filters.from ?? null, filters.to ?? null);
  if (!validation.values) {
    throw new Error('invalid_date_range');
  }

  const payload = await buildProjectSummary({
    projectId,
    currentRange: validation.values,
    previousRange: getPreviousComparableRange(validation.values)
  });

  return {
    dataset: 'summary_kpi_pack',
    suggestedFilename: `summary-kpi-pack_${projectId}_${summarizeFilters(filters)}`,
    columns: [
      { key: 'projectId', label: 'project_id' },
      { key: 'from', label: 'from' },
      { key: 'to', label: 'to' },
      { key: 'totalPrompts', label: 'total_prompts' },
      { key: 'promptsExecuted', label: 'prompts_executed' },
      { key: 'validResponses', label: 'valid_responses' },
      { key: 'mentionRate', label: 'mention_rate' },
      { key: 'citationRate', label: 'citation_rate' },
      { key: 'shareOfVoice', label: 'share_of_voice' },
      { key: 'totalCitations', label: 'total_citations' },
      { key: 'generatedAt', label: 'generated_at' }
    ],
    rows: [
      {
        projectId,
        from: payload.range.from,
        to: payload.range.to,
        totalPrompts: payload.summary.totalPrompts,
        promptsExecuted: payload.summary.promptsExecuted,
        validResponses: payload.summary.validResponses,
        mentionRate: payload.summary.mentionRate.value,
        citationRate: payload.summary.citationRate.value,
        shareOfVoice: payload.summary.shareOfVoice.value,
        totalCitations: payload.summary.sourceShare.totalCitations,
        generatedAt: payload.generatedAt
      }
    ]
  };
}

export async function buildPromptsTableExport(projectId: string, filters: ExportRequestFilters): Promise<ExportTable> {
  const query = normalizeSearchTerm(filters.q);
  const country = normalizeCountry(filters.country) ?? '';
  const language = normalizeLanguage(filters.language) ?? '';
  const intentClassification = normalizeSearchTerm(filters.intentClassification);
  const activeFilter = filters.active;
  const tagIds = parseTagIds(filters.tagIds);

  const where = {
    projectId,
    deletedAt: null,
    ...(query
      ? {
          OR: [
            { promptText: { contains: query, mode: 'insensitive' as const } },
            { title: { contains: query, mode: 'insensitive' as const } },
            { notes: { contains: query, mode: 'insensitive' as const } }
          ]
        }
      : {}),
    ...(country ? { country } : {}),
    ...(language ? { language } : {}),
    ...(intentClassification ? { intentClassification: { contains: intentClassification, mode: 'insensitive' as const } } : {}),
    ...(activeFilter === 'active' ? { isActive: true } : {}),
    ...(activeFilter === 'inactive' ? { isActive: false } : {}),
    ...(tagIds.length > 0
      ? {
          AND: tagIds.map((tagId) => ({
            promptTags: {
              some: {
                tagId,
                tag: { deletedAt: null }
              }
            }
          }))
        }
      : {})
  };

  const prompts = await prisma.prompt.findMany({
    where,
    include: {
      promptTags: {
        where: { tag: { deletedAt: null } },
        include: { tag: true },
        orderBy: { tag: { name: 'asc' } }
      },
      runs: {
        where: { status: 'SUCCEEDED' },
        orderBy: { executedAt: 'desc' },
        include: {
          responses: {
            where: { isError: false },
            include: {
              citations: { select: { id: true } },
              brandMentions: {
                where: { mentionType: 'OWN_BRAND' },
                select: { id: true }
              }
            }
          }
        }
      }
    },
    orderBy: [{ priority: 'asc' }, { updatedAt: 'desc' }]
  });

  const rows = prompts.map((prompt: (typeof prompts)[number]) => {
    const responses = prompt.runs.flatMap((run: (typeof prompt.runs)[number]) => run.responses);
    const responsesCount = responses.length;
    const mentionCount = responses.filter((response: (typeof responses)[number]) => response.brandMentions.length > 0).length;
    const citationCount = responses.filter((response: (typeof responses)[number]) => response.citations.length > 0).length;

    return {
      promptId: prompt.id,
      promptText: prompt.promptText,
      country: prompt.country,
      language: prompt.language,
      isActive: prompt.isActive,
      priority: prompt.priority,
      intentClassification: prompt.intentClassification,
      tags: prompt.promptTags.map((item: (typeof prompt.promptTags)[number]) => item.tag.name).join('|'),
      responsesCount,
      mentionRate: responsesCount > 0 ? Number((mentionCount / responsesCount).toFixed(4)) : null,
      citationRate: responsesCount > 0 ? Number((citationCount / responsesCount).toFixed(4)) : null,
      lastRunDate: asIsoDate(prompt.runs[0]?.executedAt)
    };
  });

  return {
    dataset: 'prompts_table',
    suggestedFilename: `prompts-table_${projectId}_${Date.now()}`,
    columns: [
      { key: 'promptId', label: 'prompt_id' },
      { key: 'promptText', label: 'prompt_text' },
      { key: 'country', label: 'country' },
      { key: 'language', label: 'language' },
      { key: 'isActive', label: 'is_active' },
      { key: 'priority', label: 'priority' },
      { key: 'intentClassification', label: 'intent_classification' },
      { key: 'tags', label: 'tags' },
      { key: 'responsesCount', label: 'responses_count' },
      { key: 'mentionRate', label: 'mention_rate' },
      { key: 'citationRate', label: 'citation_rate' },
      { key: 'lastRunDate', label: 'last_run_date' }
    ],
    rows
  };
}

export async function buildResponsesTableExport(projectId: string): Promise<ExportTable> {
  const pageSize = 100;
  let page = 1;
  let totalPages = 1;
  const rows: Record<string, string | number | boolean | null>[] = [];

  while (page <= totalPages) {
    const payload = await listResponses(projectId, page, pageSize);
    totalPages = payload.pagination.totalPages;

    rows.push(
      ...payload.responses.map((item: (typeof payload.responses)[number]) => ({
        responseId: item.id,
        runId: item.runId,
        promptId: item.promptId,
        promptTitle: item.promptTitle,
        promptText: item.promptText,
        runStatus: item.runStatus,
        responseStatus: item.responseStatus,
        language: item.language,
        mentionDetected: item.mentionDetected,
        mentionType: item.mentionType,
        sentiment: item.sentiment,
        rawSnippet: item.rawSnippet,
        cleanedSnippet: item.cleanedSnippet,
        createdAt: asIsoDate(item.createdAt),
        runExecutedAt: asIsoDate(item.runExecutedAt)
      }))
    );

    page += 1;
  }

  return {
    dataset: 'responses_table',
    suggestedFilename: `responses-table_${projectId}_${Date.now()}`,
    columns: [
      { key: 'responseId', label: 'response_id' },
      { key: 'runId', label: 'run_id' },
      { key: 'promptId', label: 'prompt_id' },
      { key: 'promptTitle', label: 'prompt_title' },
      { key: 'promptText', label: 'prompt_text' },
      { key: 'runStatus', label: 'run_status' },
      { key: 'responseStatus', label: 'response_status' },
      { key: 'language', label: 'language' },
      { key: 'mentionDetected', label: 'mention_detected' },
      { key: 'mentionType', label: 'mention_type' },
      { key: 'sentiment', label: 'sentiment' },
      { key: 'rawSnippet', label: 'raw_snippet' },
      { key: 'cleanedSnippet', label: 'cleaned_snippet' },
      { key: 'createdAt', label: 'created_at' },
      { key: 'runExecutedAt', label: 'run_executed_at' }
    ],
    rows
  };
}

export async function buildCitationsTableExport(projectId: string): Promise<ExportTable> {
  const pageSize = 100;
  let page = 1;
  let totalPages = 1;
  const rows: Record<string, string | number | boolean | null>[] = [];

  while (page <= totalPages) {
    const payload = await listCitations(projectId, page, pageSize);
    totalPages = payload.pagination.totalPages;

    rows.push(
      ...payload.citations.map((item: (typeof payload.citations)[number]) => ({
        citationId: item.id,
        responseId: item.responseId,
        runId: item.runId,
        promptId: item.promptId,
        promptTitle: item.promptTitle,
        promptText: item.promptText,
        model: item.model,
        sourceDomain: item.sourceDomain,
        sourceUrl: item.sourceUrl,
        title: item.title,
        snippet: item.snippet,
        position: item.position,
        createdAt: asIsoDate(item.createdAt),
        publishedAt: asIsoDate(item.publishedAt),
        runExecutedAt: asIsoDate(item.runExecutedAt)
      }))
    );

    page += 1;
  }

  return {
    dataset: 'citations_table',
    suggestedFilename: `citations-table_${projectId}_${Date.now()}`,
    columns: [
      { key: 'citationId', label: 'citation_id' },
      { key: 'responseId', label: 'response_id' },
      { key: 'runId', label: 'run_id' },
      { key: 'promptId', label: 'prompt_id' },
      { key: 'promptTitle', label: 'prompt_title' },
      { key: 'promptText', label: 'prompt_text' },
      { key: 'model', label: 'model' },
      { key: 'sourceDomain', label: 'source_domain' },
      { key: 'sourceUrl', label: 'source_url' },
      { key: 'title', label: 'title' },
      { key: 'snippet', label: 'snippet' },
      { key: 'position', label: 'position' },
      { key: 'createdAt', label: 'created_at' },
      { key: 'publishedAt', label: 'published_at' },
      { key: 'runExecutedAt', label: 'run_executed_at' }
    ],
    rows
  };
}

export async function buildCompetitorsComparisonExport(projectId: string, filters: ExportRequestFilters): Promise<ExportTable> {
  const validation = validateSummaryDateRange(filters.from ?? null, filters.to ?? null);
  if (!validation.values) {
    throw new Error('invalid_date_range');
  }

  const payload = await buildProjectCompetitorComparison({
    projectId,
    range: validation.values
  });

  const rows: Record<string, string | number | boolean | null>[] = [];

  for (const item of payload.comparison.mentionShareByBrand) {
    const citationRow = payload.comparison.citationShareByBrand.rows.find((row) => row.brandKey === item.brandKey);
    const sentiment = payload.comparison.sentimentSummaryByBrand.find((row) => row.brandKey === item.brandKey);

    rows.push({
      brandKey: item.brandKey,
      brandName: item.brandName,
      brandType: item.brandType,
      mentionCount: item.mentionCount,
      mentionShare: item.share,
      citationCount: citationRow?.citationCount ?? 0,
      citationShare: citationRow?.share ?? null,
      sentimentPositiveShare: sentiment?.buckets.positive.share ?? null,
      sentimentNeutralShare: sentiment?.buckets.neutral.share ?? null,
      sentimentNegativeShare: sentiment?.buckets.negative.share ?? null,
      sentimentOtherShare: sentiment?.buckets.other.share ?? null
    });
  }

  return {
    dataset: 'competitors_comparison',
    suggestedFilename: `competitors-comparison_${projectId}_${summarizeFilters(filters)}`,
    columns: [
      { key: 'brandKey', label: 'brand_key' },
      { key: 'brandName', label: 'brand_name' },
      { key: 'brandType', label: 'brand_type' },
      { key: 'mentionCount', label: 'mention_count' },
      { key: 'mentionShare', label: 'mention_share' },
      { key: 'citationCount', label: 'citation_count' },
      { key: 'citationShare', label: 'citation_share' },
      { key: 'sentimentPositiveShare', label: 'sentiment_positive_share' },
      { key: 'sentimentNeutralShare', label: 'sentiment_neutral_share' },
      { key: 'sentimentNegativeShare', label: 'sentiment_negative_share' },
      { key: 'sentimentOtherShare', label: 'sentiment_other_share' }
    ],
    rows
  };
}

import { prisma } from '@/lib/db';
import type { NarrativeInsightDraft, ExportRequestFilters, ExportTable, ReportExportPack } from '@/lib/exports/types';
import { normalizeCountry, normalizeLanguage, normalizeSearchTerm, safeTrim } from '@/lib/filters/normalization';
import { buildProjectCompetitorComparison } from '@/lib/reporting/competitor-comparison';
import { normalizeAnalysisMode, normalizeCaptureMethod, normalizeProvider, normalizeSurface } from '@/lib/reporting/dimensions';
import { buildProjectSummary } from '@/lib/reporting/summary';
import { getPreviousComparableRange, validateSummaryDateRange } from '@/lib/reporting/summary-validation';
import { buildProjectTimeseries } from '@/lib/reporting/timeseries';

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

function getValidatedDateRange(filters: ExportRequestFilters) {
  const validation = validateSummaryDateRange(filters.from ?? null, filters.to ?? null);
  if (!validation.values) {
    throw new Error('invalid_date_range');
  }

  return validation.values;
}

export async function buildSummaryKpiPackExport(projectId: string, filters: ExportRequestFilters): Promise<ExportTable> {
  const range = getValidatedDateRange(filters);

  const payload = await buildProjectSummary({
    projectId,
    currentRange: range,
    previousRange: getPreviousComparableRange(range),
    filters: {
      provider: normalizeProvider(filters.provider),
      surface: normalizeSurface(filters.surface),
      analysisMode: normalizeAnalysisMode(filters.analysisMode),
      modelLabel: normalizeSearchTerm(filters.modelLabel),
      captureMethod: normalizeCaptureMethod(filters.captureMethod)
    }
  });

  return {
    dataset: 'summary_kpi_pack',
    sectionName: 'summary_kpis',
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

export async function buildTimeseriesExport(projectId: string, filters: ExportRequestFilters): Promise<ExportTable> {
  const range = getValidatedDateRange(filters);
  const granularity = filters.granularity === 'week' ? 'week' : 'day';

  const payload = await buildProjectTimeseries({
    projectId,
    range,
    granularity,
    filters: {
      provider: normalizeProvider(filters.provider),
      surface: normalizeSurface(filters.surface),
      analysisMode: normalizeAnalysisMode(filters.analysisMode),
      modelLabel: normalizeSearchTerm(filters.modelLabel),
      captureMethod: normalizeCaptureMethod(filters.captureMethod)
    }
  });

  const rows = payload.series.flatMap((point) =>
    Object.entries(point.values).map(([metric, value]) => ({
      date: point.periodStart,
      metric,
      value: Number(value)
    }))
  );

  return {
    dataset: 'timeseries',
    sectionName: 'timeseries',
    suggestedFilename: `timeseries_${projectId}_${summarizeFilters(filters)}`,
    columns: [
      { key: 'date', label: 'date' },
      { key: 'metric', label: 'metric' },
      { key: 'value', label: 'value' }
    ],
    rows
  };
}

export async function buildPromptsPerformanceExport(projectId: string, filters: ExportRequestFilters): Promise<ExportTable> {
  const range = getValidatedDateRange(filters);
  const tagIds = parseTagIds(filters.tagIds);

  const prompts = await prisma.prompt.findMany({
    where: {
      projectId,
      deletedAt: null,
      ...(filters.country ? { country: normalizeCountry(filters.country) ?? undefined } : {}),
      ...(filters.language ? { language: normalizeLanguage(filters.language) ?? undefined } : {}),
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
    },
    include: {
      promptTags: {
        where: { tag: { deletedAt: null } },
        include: { tag: true }
      },
      runs: {
        where: {
          executedAt: {
            gte: range.from,
            lte: range.to
          },
          ...{
            ...(
              normalizeProvider(filters.provider)
                ? { provider: normalizeProvider(filters.provider) }
                : {}
            ),
            ...(normalizeSurface(filters.surface) ? { surface: normalizeSurface(filters.surface) } : {}),
            ...(normalizeAnalysisMode(filters.analysisMode) ? { analysisMode: normalizeAnalysisMode(filters.analysisMode) } : {}),
            ...(normalizeSearchTerm(filters.modelLabel) ? { model: normalizeSearchTerm(filters.modelLabel) } : {}),
            ...(normalizeCaptureMethod(filters.captureMethod)
              ? { captureMethod: normalizeCaptureMethod(filters.captureMethod) }
              : {})
          }
        },
        include: {
          responses: {
            where: { isError: false },
            include: {
              citations: { select: { id: true } },
              brandMentions: {
                where: { mentionType: 'COMPETITOR' },
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
    const citedResponses = responses.filter((response: (typeof responses)[number]) => response.citations.length > 0).length;
    const competitorResponses = responses.filter((response: (typeof responses)[number]) => response.brandMentions.length > 0).length;

    return {
      promptId: prompt.id,
      title: prompt.title,
      promptText: prompt.promptText,
      tags: prompt.promptTags.map((item: (typeof prompt.promptTags)[number]) => item.tag.name).join('|'),
      executions: prompt.runs.length,
      validResponses: responsesCount,
      citationRate: responsesCount > 0 ? Number((citedResponses / responsesCount).toFixed(4)) : null,
      competitorPresence: responsesCount > 0 ? Number((competitorResponses / responsesCount).toFixed(4)) : null
    };
  });

  return {
    dataset: 'prompts_performance',
    sectionName: 'prompts_performance',
    suggestedFilename: `prompts-performance_${projectId}_${summarizeFilters(filters)}`,
    columns: [
      { key: 'promptId', label: 'prompt_id' },
      { key: 'title', label: 'title' },
      { key: 'promptText', label: 'prompt_text' },
      { key: 'tags', label: 'tags' },
      { key: 'executions', label: 'executions' },
      { key: 'validResponses', label: 'valid_responses' },
      { key: 'citationRate', label: 'citation_rate' },
      { key: 'competitorPresence', label: 'competitor_presence' }
    ],
    rows
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
    sectionName: 'prompts_table',
    suggestedFilename: `prompts-table_${projectId}_${summarizeFilters(filters)}`,
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

export async function buildResponsesTableExport(projectId: string, filters?: ExportRequestFilters): Promise<ExportTable> {
  const range = filters?.from || filters?.to ? getValidatedDateRange(filters) : null;

  const responses = await prisma.response.findMany({
    where: {
      run: {
        projectId,
        ...(range
          ? {
              executedAt: {
                gte: range.from,
                lte: range.to
              }
            }
          : {})
      }
    },
    include: {
      run: {
        select: {
          id: true,
          status: true,
          executedAt: true,
          prompt: {
            select: {
              id: true,
              title: true,
              promptText: true
            }
          }
        }
      }
    },
    orderBy: [{ createdAt: 'desc' }]
  });

  return {
    dataset: 'responses_table',
    sectionName: 'responses',
    suggestedFilename: `responses-table_${projectId}_${summarizeFilters(filters ?? {})}`,
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
    rows: responses.map((item: (typeof responses)[number]) => ({
      responseId: item.id,
      runId: item.runId,
      promptId: item.run.prompt.id,
      promptTitle: item.run.prompt.title,
      promptText: item.run.prompt.promptText,
      runStatus: item.run.status,
      responseStatus: item.status,
      language: item.language,
      mentionDetected: item.mentionDetected,
      mentionType: item.mentionType,
      sentiment: item.sentiment,
      rawSnippet: item.rawText.slice(0, 300),
      cleanedSnippet: (item.cleanedText ?? '').slice(0, 300),
      createdAt: asIsoDate(item.createdAt),
      runExecutedAt: asIsoDate(item.run.executedAt)
    }))
  };
}

export async function buildCitationsTableExport(projectId: string, filters?: ExportRequestFilters): Promise<ExportTable> {
  const range = filters?.from || filters?.to ? getValidatedDateRange(filters) : null;

  const citations = await prisma.citation.findMany({
    where: {
      response: {
        run: {
          projectId,
          ...(range
            ? {
                executedAt: {
                  gte: range.from,
                  lte: range.to
                }
              }
            : {})
        }
      }
    },
    include: {
      response: {
        select: {
          id: true,
          run: {
            select: {
              id: true,
              model: true,
              executedAt: true,
              prompt: {
                select: {
                  id: true,
                  title: true,
                  promptText: true
                }
              }
            }
          }
        }
      }
    },
    orderBy: [{ createdAt: 'desc' }]
  });

  return {
    dataset: 'citations_table',
    sectionName: 'citations',
    suggestedFilename: `citations-table_${projectId}_${summarizeFilters(filters ?? {})}`,
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
    rows: citations.map((item: (typeof citations)[number]) => ({
      citationId: item.id,
      responseId: item.responseId,
      runId: item.response.run.id,
      promptId: item.response.run.prompt.id,
      promptTitle: item.response.run.prompt.title,
      promptText: item.response.run.prompt.promptText,
      model: item.response.run.model,
      sourceDomain: item.sourceDomain,
      sourceUrl: item.sourceUrl,
      title: item.title,
      snippet: item.snippet,
      position: item.position,
      createdAt: asIsoDate(item.createdAt),
      publishedAt: asIsoDate(item.publishedAt),
      runExecutedAt: asIsoDate(item.response.run.executedAt)
    }))
  };
}

export async function buildCompetitorsComparisonExport(projectId: string, filters: ExportRequestFilters): Promise<ExportTable> {
  const range = getValidatedDateRange(filters);

  const payload = await buildProjectCompetitorComparison({
    projectId,
    range,
    filters: {
      provider: normalizeProvider(filters.provider),
      surface: normalizeSurface(filters.surface),
      analysisMode: normalizeAnalysisMode(filters.analysisMode),
      modelLabel: normalizeSearchTerm(filters.modelLabel),
      captureMethod: normalizeCaptureMethod(filters.captureMethod)
    }
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
    sectionName: 'competitors_comparison',
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

export function buildNarrativeInsightsDraft(input: {
  summary: ExportTable;
  promptsPerformance: ExportTable;
  citations: ExportTable;
  competitors: ExportTable;
}): NarrativeInsightDraft[] {
  const insights: NarrativeInsightDraft[] = [];

  const bestPrompt = [...input.promptsPerformance.rows]
    .filter((row) => typeof row.citationRate === 'number')
    .sort((a, b) => Number(b.citationRate ?? 0) - Number(a.citationRate ?? 0))[0];
  if (bestPrompt) {
    insights.push({
      area: 'strongest_prompts',
      bullet: `Analyst draft: Prompt "${bestPrompt.title}" appears strongest with citation_rate=${bestPrompt.citationRate} over valid_responses=${bestPrompt.validResponses}.`,
      metrics: {
        prompt_id: String(bestPrompt.promptId),
        citation_rate: Number(bestPrompt.citationRate),
        valid_responses: Number(bestPrompt.validResponses)
      }
    });
  }

  const domains = new Map<string, number>();
  for (const row of input.citations.rows) {
    const domain = String(row.sourceDomain ?? '').trim().toLowerCase();
    if (!domain) {
      continue;
    }
    domains.set(domain, (domains.get(domain) ?? 0) + 1);
  }
  const topDomain = [...domains.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topDomain) {
    insights.push({
      area: 'source_opportunities',
      bullet: `Analyst draft: Source concentration shows ${topDomain[0]} with citations=${topDomain[1]} in this range; review if diversification is needed.`,
      metrics: {
        source_domain: topDomain[0],
        citations: topDomain[1],
        distinct_domains: domains.size
      }
    });
  }

  const strongestCompetitor = [...input.competitors.rows]
    .filter((row) => row.brandType === 'COMPETITOR')
    .sort((a, b) => Number(b.mentionShare ?? 0) - Number(a.mentionShare ?? 0))[0];
  if (strongestCompetitor) {
    insights.push({
      area: 'competitor_pressure',
      bullet: `Analyst draft: Competitor pressure is led by ${strongestCompetitor.brandName} with mention_share=${strongestCompetitor.mentionShare} and citation_share=${strongestCompetitor.citationShare}.`,
      metrics: {
        competitor: String(strongestCompetitor.brandName),
        mention_share: Number(strongestCompetitor.mentionShare ?? 0),
        citation_share: Number(strongestCompetitor.citationShare ?? 0)
      }
    });
  }

  const summaryRow = input.summary.rows[0];
  if (summaryRow) {
    insights.push({
      area: 'model_differences',
      bullet: `Analyst draft: Aggregate period ended with mention_rate=${summaryRow.mentionRate}, citation_rate=${summaryRow.citationRate}, share_of_voice=${summaryRow.shareOfVoice}; compare these metrics across model tabs for deeper diagnosis.`,
      metrics: {
        mention_rate: Number(summaryRow.mentionRate ?? 0),
        citation_rate: Number(summaryRow.citationRate ?? 0),
        share_of_voice: Number(summaryRow.shareOfVoice ?? 0)
      }
    });
  }

  return insights;
}

export async function buildReportPackExport(projectId: string, filters: ExportRequestFilters): Promise<ReportExportPack> {
  const [summary, timeseries, promptsPerformance, responses, citations, competitors] = await Promise.all([
    buildSummaryKpiPackExport(projectId, filters),
    buildTimeseriesExport(projectId, filters),
    buildPromptsPerformanceExport(projectId, filters),
    buildResponsesTableExport(projectId, filters),
    buildCitationsTableExport(projectId, filters),
    buildCompetitorsComparisonExport(projectId, filters)
  ]);

  const narrativeInsights = filters.includeNarrativeInsights
    ? buildNarrativeInsightsDraft({
        summary,
        promptsPerformance,
        citations,
        competitors
      })
    : [];

  return {
    dataset: 'report_pack',
    suggestedFilename: `report-pack_${projectId}_${summarizeFilters(filters)}`,
    sections: [summary, timeseries, promptsPerformance, responses, citations, competitors],
    narrativeInsights
  };
}

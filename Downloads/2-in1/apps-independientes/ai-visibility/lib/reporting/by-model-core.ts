import { normalizeModelLabel } from '@/lib/filters/normalization';
import { computeKpis, type ComputeKpisInput, type ComputedKpis } from '@/lib/kpi/calculations';

type ByModelPeriod = {
  validResponses: number;
  mentionRate: ComputedKpis['mention_rate'];
  citationRate: ComputedKpis['citation_rate'];
  sourceShare: ComputedKpis['source_share'];
  sentimentDistribution: ComputedKpis['sentiment_distribution'];
  strongestPrompts: ComputedKpis['top_prompts'];
  weakestPrompts: ComputedKpis['weakest_prompts'];
  topCitedDomains: ComputedKpis['top_cited_domains'];
};

export type ModelReportRow = {
  provider: string;
  surface: string;
  analysisMode: string;
  modelLabel: string;
  summary: ByModelPeriod;
};

export type KpiInputsWithModel = Omit<ComputeKpisInput, 'runs'> & {
  runs: Array<ComputeKpisInput['runs'][number] & { model: string; provider?: string | null; surface?: string | null; analysisMode?: string | null }>;
};

function toModelSummary(kpis: ComputedKpis): ByModelPeriod {
  return {
    validResponses: kpis.valid_response_count,
    mentionRate: kpis.mention_rate,
    citationRate: kpis.citation_rate,
    sourceShare: kpis.source_share,
    sentimentDistribution: kpis.sentiment_distribution,
    strongestPrompts: kpis.top_prompts,
    weakestPrompts: kpis.weakest_prompts,
    topCitedDomains: kpis.top_cited_domains
  };
}

export function buildByModelFromInputs(data: KpiInputsWithModel): ModelReportRow[] {
  const runModelById = new Map<string, string>();
  const modelBuckets = new Map<string, KpiInputsWithModel>();

  for (const run of data.runs) {
    const modelLabel = normalizeModelLabel(run.model) ?? 'unknown';
    const provider = (run.provider ?? 'other').toLowerCase();
    const surface = (run.surface ?? 'other').toLowerCase();
    const analysisMode = (run.analysisMode ?? 'other').toLowerCase();
    const bucketKey = `${provider}::${surface}::${analysisMode}::${modelLabel}`;
    runModelById.set(run.id, bucketKey);

    const bucket = modelBuckets.get(bucketKey) ?? {
      prompts: data.prompts,
      runs: [],
      responses: [],
      citations: [],
      mentions: []
    };

    bucket.runs.push(run);
    modelBuckets.set(bucketKey, bucket);
  }

  const responseIdsByModel = new Map<string, Set<string>>();

  for (const response of data.responses) {
    const model = runModelById.get(response.runId);
    if (!model) {
      continue;
    }

    const bucket = modelBuckets.get(model);
    if (!bucket) {
      continue;
    }

    bucket.responses.push(response);

    const responseIds = responseIdsByModel.get(model) ?? new Set<string>();
    responseIds.add(response.id);
    responseIdsByModel.set(model, responseIds);
  }

  for (const citation of data.citations) {
    for (const [model, responseIds] of responseIdsByModel.entries()) {
      if (!responseIds.has(citation.responseId)) {
        continue;
      }

      const bucket = modelBuckets.get(model);
      if (bucket) {
        bucket.citations.push(citation);
      }
      break;
    }
  }

  for (const mention of data.mentions) {
    for (const [model, responseIds] of responseIdsByModel.entries()) {
      if (!responseIds.has(mention.responseId)) {
        continue;
      }

      const bucket = modelBuckets.get(model);
      if (bucket) {
        bucket.mentions.push(mention);
      }
      break;
    }
  }

  return Array.from(modelBuckets.entries())
    .map(([bucketKey, bucket]) => {
      const [provider, surface, analysisMode, modelLabel] = bucketKey.split('::');
      return { provider, surface, analysisMode, modelLabel, summary: toModelSummary(computeKpis(bucket)) };
    })
    .sort((a, b) => a.analysisMode.localeCompare(b.analysisMode) || a.modelLabel.localeCompare(b.modelLabel));
}

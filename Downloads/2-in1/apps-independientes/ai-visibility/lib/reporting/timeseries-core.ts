import type { KpiMentionType, KpiResponseStatus, KpiRunStatus } from '@/lib/kpi/calculations';
import type { SummaryDateRange } from '@/lib/reporting/summary-validation';
import type { TimeseriesGranularity } from '@/lib/reporting/timeseries-validation';

export type MetricKey =
  | 'brand_mentions'
  | 'mention_rate'
  | 'citation_rate'
  | 'share_of_voice'
  | 'valid_responses'
  | 'sentiment_positive_share';

export const SUPPORTED_METRICS: MetricKey[] = [
  'brand_mentions',
  'mention_rate',
  'citation_rate',
  'share_of_voice',
  'valid_responses',
  'sentiment_positive_share'
];

export type TimeseriesPoint = {
  periodStart: string;
  periodEnd: string;
  values: Record<MetricKey, number>;
};

export type ResponseRecord = {
  id: string;
  run: {
    id: string;
    status: KpiRunStatus;
    executedAt: Date;
  };
  status: KpiResponseStatus;
  mentionDetected: boolean;
  sentiment: string | null;
};

export type CitationRecord = {
  responseId: string;
};

export type MentionRecord = {
  responseId: string;
  mentionType: KpiMentionType;
  mentionCount: number;
};

type BucketAggregate = {
  periodStart: Date;
  periodEnd: Date;
  validResponses: number;
  mentionRateNumerator: number;
  citationRateNumerator: number;
  ownBrandMentions: number;
  competitorMentions: number;
  sentimentPositiveCount: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 0, 0, 0, 0));
}

function endOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 23, 59, 59, 999));
}

function startOfUtcIsoWeek(value: Date): Date {
  const dayStart = startOfUtcDay(value);
  const dayOfWeek = dayStart.getUTCDay();
  const isoOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  return new Date(dayStart.getTime() - isoOffset * DAY_MS);
}

function addDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * DAY_MS);
}

function endOfUtcIsoWeek(value: Date): Date {
  const start = startOfUtcIsoWeek(value);
  return new Date(addDays(start, 7).getTime() - 1);
}

function clamp(value: Date, min: Date, max: Date): Date {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
}

function normalizeSentiment(sentiment: string | null): string {
  return (sentiment ?? '').trim().toLowerCase();
}

function rate(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }

  return numerator / denominator;
}

function getBucketKey(date: Date, granularity: TimeseriesGranularity): string {
  return (granularity === 'day' ? startOfUtcDay(date) : startOfUtcIsoWeek(date)).toISOString();
}

function getBucketPeriod(date: Date, granularity: TimeseriesGranularity): { start: Date; end: Date } {
  if (granularity === 'day') {
    return {
      start: startOfUtcDay(date),
      end: endOfUtcDay(date)
    };
  }

  return {
    start: startOfUtcIsoWeek(date),
    end: endOfUtcIsoWeek(date)
  };
}

export function buildTimeseriesFromRecords(
  range: SummaryDateRange,
  granularity: TimeseriesGranularity,
  responses: ResponseRecord[],
  citations: CitationRecord[],
  mentions: MentionRecord[]
): TimeseriesPoint[] {
  const bucketStart = granularity === 'day' ? startOfUtcDay(range.from) : startOfUtcIsoWeek(range.from);
  const bucketStop = granularity === 'day' ? startOfUtcDay(range.to) : startOfUtcIsoWeek(range.to);

  const citationCountByResponseId = new Map<string, number>();
  for (const citation of citations) {
    citationCountByResponseId.set(citation.responseId, (citationCountByResponseId.get(citation.responseId) ?? 0) + 1);
  }

  const mentionsByResponseId = new Map<string, MentionRecord[]>();
  for (const mention of mentions) {
    const rows = mentionsByResponseId.get(mention.responseId) ?? [];
    rows.push(mention);
    mentionsByResponseId.set(mention.responseId, rows);
  }

  const buckets = new Map<string, BucketAggregate>();

  for (let cursor = bucketStart; cursor.getTime() <= bucketStop.getTime(); cursor = addDays(cursor, granularity === 'day' ? 1 : 7)) {
    const key = cursor.toISOString();
    const period = getBucketPeriod(cursor, granularity);

    buckets.set(key, {
      periodStart: clamp(period.start, range.from, range.to),
      periodEnd: clamp(period.end, range.from, range.to),
      validResponses: 0,
      mentionRateNumerator: 0,
      citationRateNumerator: 0,
      ownBrandMentions: 0,
      competitorMentions: 0,
      sentimentPositiveCount: 0
    });
  }

  for (const response of responses) {
    const isValid = response.status === 'SUCCEEDED' && response.run.status === 'SUCCEEDED';
    if (!isValid) {
      continue;
    }

    const key = getBucketKey(response.run.executedAt, granularity);
    const bucket = buckets.get(key);
    if (!bucket) {
      continue;
    }

    bucket.validResponses += 1;

    if (response.mentionDetected) {
      bucket.mentionRateNumerator += 1;
    }

    if ((citationCountByResponseId.get(response.id) ?? 0) > 0) {
      bucket.citationRateNumerator += 1;
    }

    const sentiment = normalizeSentiment(response.sentiment);
    if (sentiment === 'positive') {
      bucket.sentimentPositiveCount += 1;
    }

    const responseMentions = mentionsByResponseId.get(response.id) ?? [];
    for (const mention of responseMentions) {
      const amount = mention.mentionCount > 0 ? mention.mentionCount : 0;
      if (mention.mentionType === 'OWN_BRAND') {
        bucket.ownBrandMentions += amount;
      } else if (mention.mentionType === 'COMPETITOR') {
        bucket.competitorMentions += amount;
      }
    }
  }

  return Array.from(buckets.values()).map((bucket) => {
    const totalTrackedMentions = bucket.ownBrandMentions + bucket.competitorMentions;

    return {
      periodStart: bucket.periodStart.toISOString(),
      periodEnd: bucket.periodEnd.toISOString(),
      values: {
        brand_mentions: bucket.ownBrandMentions,
        mention_rate: rate(bucket.mentionRateNumerator, bucket.validResponses),
        citation_rate: rate(bucket.citationRateNumerator, bucket.validResponses),
        share_of_voice: rate(bucket.ownBrandMentions, totalTrackedMentions),
        valid_responses: bucket.validResponses,
        sentiment_positive_share: rate(bucket.sentimentPositiveCount, bucket.validResponses)
      }
    };
  });
}

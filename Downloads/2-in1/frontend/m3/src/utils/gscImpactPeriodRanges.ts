import { validateWindowSchema } from '@/utils/gscImpactEngine';

export interface PeriodRanges {
  pre: { start: string; end: string };
  rollout: { start: string; end: string };
  post: { start: string; end: string };
}

const toISODate = (date: Date) => date.toISOString().split('T')[0];

export const buildDefaultRanges = (rolloutDate: string): PeriodRanges => {
  const rollout = new Date(`${rolloutDate}T00:00:00Z`);

  const preEnd = new Date(rollout);
  preEnd.setUTCDate(preEnd.getUTCDate() - 1);
  const preStart = new Date(preEnd);
  preStart.setUTCDate(preStart.getUTCDate() - 27);

  const rolloutStart = new Date(rollout);
  rolloutStart.setUTCDate(rolloutStart.getUTCDate() - 6);
  const rolloutEnd = new Date(rollout);
  rolloutEnd.setUTCDate(rolloutEnd.getUTCDate() + 7);

  const postStart = new Date(rollout);
  postStart.setUTCDate(postStart.getUTCDate() + 1);
  const postEnd = new Date(postStart);
  postEnd.setUTCDate(postEnd.getUTCDate() + 27);
  const today = new Date();

  return {
    pre: { start: toISODate(preStart), end: toISODate(preEnd) },
    rollout: { start: toISODate(rolloutStart), end: toISODate(rolloutEnd) },
    post: { start: toISODate(postStart), end: toISODate(postEnd > today ? today : postEnd) },
  };
};

const getRangeField = (params: URLSearchParams, name: string) => params.get(name)?.trim() || '';

export const buildPeriodRangesFromParams = (
  params: URLSearchParams,
  fallbackRolloutDate: string,
): { ranges: PeriodRanges; hasCompleteRangeParams: boolean } => {
  const fromParams: PeriodRanges = {
    pre: {
      start: getRangeField(params, 'preStart'),
      end: getRangeField(params, 'preEnd'),
    },
    rollout: {
      start: getRangeField(params, 'rolloutStart'),
      end: getRangeField(params, 'rolloutEnd'),
    },
    post: {
      start: getRangeField(params, 'postStart'),
      end: getRangeField(params, 'postEnd'),
    },
  };

  const hasCompleteRangeParams = Object.values(fromParams).every((range) => Boolean(range.start && range.end));
  if (hasCompleteRangeParams) {
    return { ranges: fromParams, hasCompleteRangeParams: true };
  }

  return {
    ranges: buildDefaultRanges(fallbackRolloutDate),
    hasCompleteRangeParams: false,
  };
};

export const mapPeriodRangesToSearchParams = (params: URLSearchParams, ranges: PeriodRanges) => {
  params.set('preStart', ranges.pre.start);
  params.set('preEnd', ranges.pre.end);
  params.set('rolloutStart', ranges.rollout.start);
  params.set('rolloutEnd', ranges.rollout.end);
  params.set('postStart', ranges.post.start);
  params.set('postEnd', ranges.post.end);
};

const WINDOW_ERROR_MAP: Record<string, string> = {
  preUpdate: 'pre-update',
  rollout: 'rollout',
  postUpdate: 'post-update',
};

const normalizeValidationError = (error: string) => {
  const normalized = error
    .replace('Window preUpdate', 'La ventana pre-update')
    .replace('Window rollout', 'La ventana rollout')
    .replace('Window postUpdate', 'La ventana post-update')
    .replace('has invalid date format', 'tiene un formato de fecha inválido')
    .replace('is empty: start must be before or equal to end', 'es inválida: start debe ser menor o igual que end')
    .replace('Windows', 'Las ventanas')
    .replace('and', 'y')
    .replace('overlap', 'se solapan');

  return normalized.endsWith('.') ? normalized : `${normalized}.`;
};

export const validatePeriodRanges = (ranges: PeriodRanges): string[] => {
  const requiredErrors: string[] = [];
  (Object.entries(ranges) as Array<[keyof PeriodRanges, { start: string; end: string }]>).forEach(([name, range]) => {
    if (!range.start || !range.end) {
      requiredErrors.push(`Completa start/end para ${name}.`);
    }
  });

  if (requiredErrors.length > 0) {
    return requiredErrors;
  }

  const result = validateWindowSchema({
    preUpdate: ranges.pre,
    rollout: ranges.rollout,
    postUpdate: ranges.post,
  });

  return result.errors.map((error) => {
    const mappedWindowError = Object.entries(WINDOW_ERROR_MAP).reduce(
      (message, [source, target]) => message.replace(source, target),
      error,
    );

    return normalizeValidationError(mappedWindowError);
  });
};

import { ChecklistItem, ChecklistKey, ChecklistStatus, SeoPage } from '../types/seoChecklist';

export type CheckPriority = 'alta' | 'media' | 'baja';

const PRIORITY_BUCKETS: Record<CheckPriority, ChecklistKey[]> = {
  alta: ['CONTENIDOS', 'SNIPPETS', 'ENLAZADO_INTERNO', 'ESTRUCTURA', 'UX', 'WPO', 'CTA'],
  media: ['DATOS_ESTRUCTURADOS', 'GEOLOCALIZACION', 'IMAGENES', 'SEMANTICA', 'OPORTUNIDADES'],
  baja: ['CLUSTER', 'ENLACE', 'GEO_IMAGENES'],
};

const PRIORITY_RANK: Record<CheckPriority, number> = {
  alta: 0,
  media: 1,
  baja: 2,
};

const KEY_TO_PRIORITY: Record<ChecklistKey, CheckPriority> = Object.entries(PRIORITY_BUCKETS).reduce(
  (acc, [priority, keys]) => {
    keys.forEach((key) => {
      acc[key as ChecklistKey] = priority as CheckPriority;
    });
    return acc;
  },
  {} as Record<ChecklistKey, CheckPriority>,
);

export interface PendingCheckDescriptor {
  key: ChecklistKey;
  label: string;
  priority: CheckPriority;
  status_manual: ChecklistStatus;
  notes_manual: string;
  recommendation?: string;
  autoData?: any;
}

export interface PendingChecksResult {
  pending: PendingCheckDescriptor[];
  skippedSi: PendingCheckDescriptor[];
}

export const getChecklistPriority = (key: ChecklistKey): CheckPriority => {
  return KEY_TO_PRIORITY[key] || 'media';
};

export const buildPendingChecks = (page: SeoPage): PendingChecksResult => {
  const allChecks = Object.values(page.checklist) as ChecklistItem[];

  const materialized = allChecks.map((item) => ({
    key: item.key,
    label: item.label,
    priority: getChecklistPriority(item.key),
    status_manual: item.status_manual,
    notes_manual: item.notes_manual,
    recommendation: item.recommendation,
    autoData: item.autoData,
  }));

  const skippedSi = materialized.filter((item) => item.status_manual === 'SI');
  const pending = materialized
    .filter((item) => item.status_manual !== 'SI')
    .sort((a, b) => {
      const byPriority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (byPriority !== 0) return byPriority;
      return a.label.localeCompare(b.label);
    });

  return { pending, skippedSi };
};

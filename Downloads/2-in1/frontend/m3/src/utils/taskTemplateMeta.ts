import { TaskTemplateMeta } from '@/types';

export const getTemplateBadgeText = (templateMeta?: TaskTemplateMeta): string | null => {
  if (!templateMeta) {
    return null;
  }

  if (templateMeta.origin === 'project_type') {
    return `Sugerida por tipología · ${templateMeta.projectType}`;
  }

  if (templateMeta.origin === 'sector') {
    return `Sugerida por sector · ${templateMeta.sector || 'Genérico'}`;
  }

  if (templateMeta.origin === 'client_custom') {
    return 'Personalizada por cliente';
  }

  return 'Plantilla genérica';
};

export const getTemplateBadgeTone = (templateMeta?: TaskTemplateMeta): string => {
  if (!templateMeta) {
    return 'text-slate-500 bg-slate-50 border-slate-200';
  }

  if (templateMeta.origin === 'sector') {
    return 'text-violet-700 bg-violet-50 border-violet-200';
  }

  if (templateMeta.origin === 'project_type') {
    return 'text-cyan-700 bg-cyan-50 border-cyan-200';
  }

  if (templateMeta.origin === 'client_custom') {
    return 'text-purple-700 bg-purple-50 border-purple-200';
  }

  return 'text-slate-500 bg-slate-50 border-slate-200';
};

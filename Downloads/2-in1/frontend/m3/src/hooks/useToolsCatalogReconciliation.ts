import { useEffect, useMemo, useState } from 'react';
import { sharedToolsCatalog, SharedToolCatalogItem } from '@/config/toolsCatalog';
import { api, LauncherAppItem, ToolCatalogItem } from '@/services/api';

export type CatalogSource = 'methodology' | 'backend' | 'launcher';
export type CatalogMatchLevel =
  | 'matched'
  | 'possibleMatch'
  | 'methodologyOnly'
  | 'backendOnly'
  | 'launcherOnly'
  | 'issue';
export type CatalogConsistencyLevel = 'high' | 'medium' | 'low' | 'degraded';
export type CatalogReconciliationStatus = 'loading' | 'ready' | 'degraded';

export interface CatalogReconciliationItem {
  id: string;
  name: string;
  sources: CatalogSource[];
  status: string;
  matchLevel: CatalogMatchLevel;
  issue: string;
  recommendation: string;
}

export interface CatalogReconciliationSummary {
  methodologyTotal: number;
  backendTotal: number;
  launcherTotal: number;
  matched: number;
  methodologyOnly: number;
  backendOnly: number;
  launcherOnly: number;
  possibleMismatches: number;
  missingRecommendedRoute: number;
  queueWithoutDryRun: number;
  requiresHumanReview: number;
  readOnlySafe: number;
  consistencyScore: number;
  consistencyLevel: CatalogConsistencyLevel;
  criticalDivergences: number;
}

export interface ToolsCatalogReconciliationResult {
  status: CatalogReconciliationStatus;
  summary: CatalogReconciliationSummary;
  items: CatalogReconciliationItem[];
  error?: string;
}

interface UseToolsCatalogReconciliationOptions {
  backendTools?: ToolCatalogItem[];
  launcherApps?: LauncherAppItem[];
}

const emptySummary: CatalogReconciliationSummary = {
  methodologyTotal: 0,
  backendTotal: 0,
  launcherTotal: 0,
  matched: 0,
  methodologyOnly: 0,
  backendOnly: 0,
  launcherOnly: 0,
  possibleMismatches: 0,
  missingRecommendedRoute: 0,
  queueWithoutDryRun: 0,
  requiresHumanReview: 0,
  readOnlySafe: 0,
  consistencyScore: 0,
  consistencyLevel: 'degraded',
  criticalDivergences: 0,
};

const normalizeKey = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const toBackendStatus = (status?: string) => status || 'unknown';

const findPossibleMethodologyMatch = (
  name: string,
  methodologyBySlug: Map<string, SharedToolCatalogItem>,
) => methodologyBySlug.get(normalizeKey(name));

const buildReconciliation = (
  backendTools: ToolCatalogItem[],
  launcherApps: LauncherAppItem[],
  status: CatalogReconciliationStatus,
  error?: string,
): ToolsCatalogReconciliationResult => {
  const methodologyById = new Map(sharedToolsCatalog.map((tool) => [tool.id, tool]));
  const methodologyBySlug = new Map(
    sharedToolsCatalog.map((tool) => [normalizeKey(tool.name), tool]),
  );
  const backendById = new Map(backendTools.map((tool) => [tool.id, tool]));
  const launcherById = new Map(launcherApps.map((app) => [app.id, app]));
  const matchedMethodologyIds = new Set<string>();
  const matchedBackendIds = new Set<string>();
  const matchedLauncherIds = new Set<string>();
  const items: CatalogReconciliationItem[] = [];

  sharedToolsCatalog.forEach((tool) => {
    const backend = backendById.get(tool.id);
    const launcher = launcherById.get(tool.id);
    const sources: CatalogSource[] = ['methodology'];
    if (backend) sources.push('backend');
    if (launcher) sources.push('launcher');

    if (backend || launcher) {
      matchedMethodologyIds.add(tool.id);
      if (backend) matchedBackendIds.add(backend.id);
      if (launcher) matchedLauncherIds.add(launcher.id);
      const runtimeStatus = backend?.status || launcher?.status;
      const statusMismatch =
        runtimeStatus && normalizeKey(runtimeStatus) !== normalizeKey(tool.status);

      items.push({
        id: tool.id,
        name: tool.name,
        sources,
        status: `${tool.status}${runtimeStatus ? ` / ${runtimeStatus}` : ''}`,
        matchLevel: statusMismatch ? 'issue' : 'matched',
        issue: statusMismatch
          ? 'Status metodológico y operativo no coinciden exactamente.'
          : 'Coincidencia por id.',
        recommendation: statusMismatch
          ? 'Revisar taxonomía de estados entre catálogo metodológico y Tools Hub.'
          : 'Mantener sincronizado en revisiones de catálogo.',
      });
      return;
    }

    items.push({
      id: tool.id,
      name: tool.name,
      sources,
      status: tool.status,
      matchLevel: 'methodologyOnly',
      issue: 'Solo existe en el catálogo metodológico.',
      recommendation:
        'Validar si debe implementarse, mantenerse como backlog o marcarse como no disponible.',
    });
  });

  backendTools.forEach((tool) => {
    if (matchedBackendIds.has(tool.id)) return;
    const possible = findPossibleMethodologyMatch(tool.name, methodologyBySlug);
    if (possible) {
      matchedMethodologyIds.add(possible.id);
      items.push({
        id: tool.id,
        name: tool.name,
        sources: ['backend'],
        status: toBackendStatus(tool.status),
        matchLevel: 'possibleMatch',
        issue: `Posible match por nombre con metodología: ${possible.name}.`,
        recommendation: 'Confirmar manualmente antes de consolidar ids.',
      });
      return;
    }

    items.push({
      id: tool.id,
      name: tool.name,
      sources: ['backend'],
      status: toBackendStatus(tool.status),
      matchLevel: 'backendOnly',
      issue: 'Solo existe en catálogo backend de Tools Hub.',
      recommendation:
        'Clasificar dentro del gobierno metodológico si debe ser visible en el método.',
    });
  });

  launcherApps.forEach((app) => {
    if (matchedLauncherIds.has(app.id) || backendById.has(app.id) || methodologyById.has(app.id))
      return;
    const possible = findPossibleMethodologyMatch(app.name, methodologyBySlug);
    items.push({
      id: app.id,
      name: app.name,
      sources: ['launcher'],
      status: toBackendStatus(app.status),
      matchLevel: possible ? 'possibleMatch' : 'launcherOnly',
      issue: possible
        ? `Posible match por nombre con metodología: ${possible.name}.`
        : 'Solo existe en launcher catalog.',
      recommendation: possible
        ? 'Confirmar manualmente antes de consolidar ids.'
        : 'Decidir si esta app debe entrar en catálogo metodológico o seguir solo como launcher.',
    });
  });

  const methodologyOnly = items.filter((item) => item.matchLevel === 'methodologyOnly').length;
  const backendOnly = items.filter((item) => item.matchLevel === 'backendOnly').length;
  const launcherOnly = items.filter((item) => item.matchLevel === 'launcherOnly').length;
  const possibleMismatches = items.filter(
    (item) => item.matchLevel === 'possibleMatch' || item.matchLevel === 'issue',
  ).length;
  const matched = items.filter((item) => item.matchLevel === 'matched').length;
  const missingRecommendedRoute = sharedToolsCatalog.filter(
    (tool) => !tool.recommendedRoute,
  ).length;
  const queueWithoutDryRun = sharedToolsCatalog.filter(
    (tool) => tool.canRunInQueue && !tool.supportsDryRun,
  ).length;
  const requiresHumanReview = sharedToolsCatalog.filter((tool) => tool.requiresHumanReview).length;
  const readOnlySafe = sharedToolsCatalog.filter((tool) => tool.isReadOnlySafe).length;
  const totalKnown = sharedToolsCatalog.length + backendTools.length + launcherApps.length;
  const consistencyScore = totalKnown > 0 ? Math.round((matched / totalKnown) * 100) : 0;
  const criticalDivergences =
    backendOnly + launcherOnly + possibleMismatches + missingRecommendedRoute;
  const consistencyLevel: CatalogConsistencyLevel =
    status === 'degraded'
      ? 'degraded'
      : consistencyScore >= 70 && criticalDivergences === 0
        ? 'high'
        : consistencyScore >= 35
          ? 'medium'
          : 'low';

  return {
    status,
    error,
    summary: {
      methodologyTotal: sharedToolsCatalog.length,
      backendTotal: backendTools.length,
      launcherTotal: launcherApps.length,
      matched,
      methodologyOnly,
      backendOnly,
      launcherOnly,
      possibleMismatches,
      missingRecommendedRoute,
      queueWithoutDryRun,
      requiresHumanReview,
      readOnlySafe,
      consistencyScore,
      consistencyLevel,
      criticalDivergences,
    },
    items,
  };
};

export const useToolsCatalogReconciliation = (
  options: UseToolsCatalogReconciliationOptions = {},
): ToolsCatalogReconciliationResult => {
  const hasProvidedData = Boolean(options.backendTools || options.launcherApps);
  const [backendTools, setBackendTools] = useState<ToolCatalogItem[]>(options.backendTools || []);
  const [launcherApps, setLauncherApps] = useState<LauncherAppItem[]>(options.launcherApps || []);
  const [status, setStatus] = useState<CatalogReconciliationStatus>(
    hasProvidedData ? 'ready' : 'loading',
  );
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (hasProvidedData) {
      return;
    }

    let mounted = true;

    const loadCatalogs = async () => {
      setStatus('loading');
      try {
        const [toolsRes, launcherRes] = await Promise.all([
          api.getToolsCatalog(),
          api.getLauncherCatalog(),
        ]);
        if (!mounted) return;
        setBackendTools(toolsRes.tools || []);
        setLauncherApps(launcherRes.apps || []);
        setStatus('ready');
        setError(undefined);
      } catch {
        if (!mounted) return;
        setBackendTools([]);
        setLauncherApps([]);
        setStatus('degraded');
        setError(
          'No se pudo leer catálogo backend/launcher. Reconciliación parcial con catálogo metodológico.',
        );
      }
    };

    void loadCatalogs();

    return () => {
      mounted = false;
    };
  }, [hasProvidedData, options.backendTools, options.launcherApps]);

  const effectiveBackendTools = options.backendTools || backendTools;
  const effectiveLauncherApps = options.launcherApps || launcherApps;
  const effectiveStatus: CatalogReconciliationStatus = hasProvidedData ? 'ready' : status;
  const effectiveError = hasProvidedData ? undefined : error;

  return useMemo(
    () =>
      buildReconciliation(
        effectiveBackendTools,
        effectiveLauncherApps,
        effectiveStatus,
        effectiveError,
      ),
    [effectiveBackendTools, effectiveLauncherApps, effectiveStatus, effectiveError],
  );
};

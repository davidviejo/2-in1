import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Loader2, Power, TriangleAlert, Wrench } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { Modal } from '../components/ui/Modal';
import { api, LauncherAppItem, LauncherSectionItem, ToolCatalogItem } from '../services/api';

const statusVariant: Record<ToolCatalogItem['status'], 'warning' | 'success' | 'primary'> = {
  legacy: 'warning',
  migrada: 'success',
  beta: 'primary',
};

const availabilityBadge = (tool: Pick<ToolCatalogItem, 'runtime' | 'available'>): { label: string; variant: 'danger' | 'warning' | 'success' } => {
  if (!tool.runtime.enabled || !tool.available) {
    return { label: 'Deshabilitada', variant: 'danger' };
  }
  if (tool.runtime.degraded) {
    return { label: 'Degradada', variant: 'warning' };
  }
  if (tool.runtime.requires_credentials) {
    return { label: 'Requiere credenciales', variant: 'warning' };
  }
  return { label: 'Disponible', variant: 'success' };
};

type LauncherSection = LauncherAppItem['section'] | 'apps-independientes';
type AppRuntimeStatus = 'installing' | 'starting' | 'running' | 'stopped' | 'error';
interface AppRuntimeInfo {
  status: AppRuntimeStatus;
  pid: number | null;
}

interface LauncherApp {
  id: string;
  name: string;
  description: string;
  path: string;
  section: LauncherSection;
  status: ToolCatalogItem['status'];
  runtime: ToolCatalogItem['runtime'];
  available: boolean;
  healthcheckTarget?: string;
}

const ABSOLUTE_URL_PATTERN = /^https?:\/\//i;
const HASH_ROUTE_PATTERN = /^\/#\//;

const extractOriginFromHttpTarget = (target?: string): string | null => {
  if (!target || !ABSOLUTE_URL_PATTERN.test(target)) return null;
  try {
    return new URL(target).origin;
  } catch {
    return null;
  }
};

export const resolveAppUrl = (tool: Pick<LauncherApp, 'path' | 'healthcheckTarget'>): string => {
  if (ABSOLUTE_URL_PATTERN.test(tool.path)) {
    return tool.path;
  }

  if (HASH_ROUTE_PATTERN.test(tool.path)) {
    return new URL(tool.path, window.location.origin).href;
  }

  const launcherOrigin = extractOriginFromHttpTarget(tool.healthcheckTarget);
  const baseOrigin = launcherOrigin ?? window.location.origin;
  return new URL(tool.path, `${baseOrigin}/`).href;
};

const PANEL_STORAGE_KEY = 'tools_hub_enabled_apps';
const STATUS_POLLING_MS = 5000;

const runtimeStatusBadgeVariant: Record<AppRuntimeStatus, 'warning' | 'primary' | 'success' | 'neutral' | 'danger'> = {
  installing: 'warning',
  starting: 'primary',
  running: 'success',
  stopped: 'neutral',
  error: 'danger',
};

const toRuntimeStatus = (status?: 'running' | 'stopped'): AppRuntimeStatus => {
  if (status === 'running') return 'running';
  return 'stopped';
};

const ToolsHub: React.FC = () => {
  const [tools, setTools] = useState<ToolCatalogItem[]>([]);
  const [launcherSections, setLauncherSections] = useState<LauncherSectionItem[]>([]);
  const [launcherApps, setLauncherApps] = useState<LauncherAppItem[]>([]);
  const [enabledApps, setEnabledApps] = useState<Record<string, boolean>>({});
  const [appRuntimeStatus, setAppRuntimeStatus] = useState<Record<string, AppRuntimeInfo>>({});
  const [appErrors, setAppErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingLegacyTool, setPendingLegacyTool] = useState<ToolCatalogItem | null>(null);
  const [logsAppId, setLogsAppId] = useState<string | null>(null);
  const [logsLines, setLogsLines] = useState<string[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState('');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(PANEL_STORAGE_KEY);
      if (stored) {
        setEnabledApps(JSON.parse(stored) as Record<string, boolean>);
      }
    } catch {
      setEnabledApps({});
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        const [toolsRes, launcherRes] = await Promise.all([api.getToolsCatalog(), api.getLauncherCatalog()]);
        if (mounted) {
          setTools(toolsRes.tools || []);
          setLauncherSections(launcherRes.sections || []);
          setLauncherApps(launcherRes.apps || []);
        }
      } catch {
        if (mounted) {
          setError('No se pudo cargar el catálogo de herramientas/apps.');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  const groupedCount = useMemo(() => {
    return tools.reduce(
      (acc, tool) => {
        acc[tool.status] += 1;
        return acc;
      },
      { legacy: 0, migrada: 0, beta: 0 },
    );
  }, [tools]);

  const unifiedApps = useMemo<LauncherApp[]>(() => {
    const independentTools: LauncherApp[] = tools.map((tool) => ({
      id: tool.id,
      name: tool.name,
      description: tool.description,
      path: tool.path,
      section: 'apps-independientes',
      status: tool.status,
      runtime: tool.runtime,
      available: tool.available,
    }));

    const dynamicApps: LauncherApp[] = launcherApps.map((app) => ({
      id: app.id,
      name: app.name,
      description: app.description,
      path: app.path,
      section: app.section,
      status: app.status,
      runtime: app.runtime,
      available: true,
      healthcheckTarget: app.launcher?.healthcheck?.type === 'http' ? app.launcher?.healthcheck?.target : undefined,
    }));

    return [...dynamicApps, ...independentTools];
  }, [launcherApps, tools]);

  const sections = useMemo(
    () => [
      ...launcherSections,
      {
        id: 'apps-independientes' as const,
        title: 'Apps independientes',
        description: 'Herramientas desacopladas y módulos legacy/migrados.',
      },
    ],
    [launcherSections],
  );

  const isEnabledInPanel = (appId: string) => enabledApps[appId] ?? true;

  const updateEnabledApp = (appId: string, enabled: boolean) => {
    setEnabledApps((prev) => {
      const next = { ...prev, [appId]: enabled };
      localStorage.setItem(PANEL_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const pollableApps = useMemo(() => unifiedApps.filter((app) => isEnabledInPanel(app.id)), [unifiedApps, enabledApps]);

  useEffect(() => {
    if (pollableApps.length === 0) {
      return;
    }

    let cancelled = false;

    const pollStatuses = async () => {
      const results = await Promise.allSettled(
        pollableApps.map(async (app) => ({ appId: app.id, data: await api.launcherStatus(app.id) })),
      );

      if (cancelled) return;

      setAppRuntimeStatus((prev) => {
        const next = { ...prev };
        results.forEach((result, index) => {
          const appId = pollableApps[index].id;
          if (result.status === 'fulfilled') {
            const currentStatus = prev[appId];
            if (currentStatus?.status !== 'installing' && currentStatus?.status !== 'starting') {
              next[appId] = {
                status: toRuntimeStatus(result.value.data.status),
                pid: result.value.data.pid ?? null,
              };
            }
          }
        });
        return next;
      });
    };

    pollStatuses();
    const intervalId = window.setInterval(pollStatuses, STATUS_POLLING_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [pollableApps]);

  const executeAction = async (appId: string, action: 'install' | 'start' | 'stop') => {
    setAppErrors((prev) => ({ ...prev, [appId]: '' }));
    setAppRuntimeStatus((prev) => ({
      ...prev,
      [appId]: {
        status: action === 'install' ? 'installing' : action === 'start' ? 'starting' : prev[appId]?.status ?? 'stopped',
        pid: prev[appId]?.pid ?? null,
      },
    }));

    try {
      const response = action === 'install' ? await api.launcherInstall(appId) : action === 'start' ? await api.launcherStart(appId) : await api.launcherStop(appId);
      setAppRuntimeStatus((prev) => ({
        ...prev,
        [appId]: {
          status: response.status ? toRuntimeStatus(response.status) : action === 'start' ? 'running' : 'stopped',
          pid: response.pid ?? null,
        },
      }));
    } catch {
      setAppRuntimeStatus((prev) => ({ ...prev, [appId]: { status: 'error', pid: prev[appId]?.pid ?? null } }));
      setAppErrors((prev) => ({
        ...prev,
        [appId]: `No se pudo ejecutar la acción ${action} para la app.`,
      }));
    }
  };

  const refreshLogs = async (appId: string) => {
    setLogsLoading(true);
    setLogsError('');
    try {
      const response = await api.launcherLogs(appId, 200);
      setLogsLines(response.lines || []);
    } catch {
      setLogsError('No se pudieron cargar los logs de la app.');
    } finally {
      setLogsLoading(false);
    }
  };

  const openLogs = (appId: string) => {
    setLogsAppId(appId);
    setLogsLines([]);
    setLogsError('');
    void refreshLogs(appId);
  };

  const openApp = (tool: LauncherApp) => {
    const runtimeStatus = appRuntimeStatus[tool.id]?.status ?? 'stopped';
    const healthcheckOk = tool.runtime.enabled && tool.available;
    if (!isEnabledInPanel(tool.id) || !tool.path || (!healthcheckOk && runtimeStatus !== 'running')) {
      return;
    }

    if (tool.status === 'legacy') {
      const legacyPath = resolveAppUrl(tool);
      setPendingLegacyTool({
        id: tool.id,
        name: tool.name,
        description: tool.description,
        path: legacyPath,
        status: 'legacy',
        available: true,
        runtime: tool.runtime,
      });
      return;
    }
    window.location.href = resolveAppUrl(tool);
  };

  const sectionSummary = useMemo(() => {
    return sections.map((section) => {
      const apps = unifiedApps.filter((app) => app.section === section.id);
      const enabled = apps.filter((app) => isEnabledInPanel(app.id)).length;
      return { section: section.id, total: apps.length, enabled };
    });
  }, [unifiedApps, sections, enabledApps]);

  return (
    <div className="space-y-6">
      <Card className="border-border bg-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted">Tools Hub</p>
            <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold text-foreground">
              <Wrench size={22} />
              Panel central de apps
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-muted">
              Centraliza el acceso a frontend, backend y apps integradas en carpeta raíz, sin abrir una terminal por
              cada app.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="warning">Legacy: {groupedCount.legacy}</Badge>
            <Badge variant="success">Migrada: {groupedCount.migrada}</Badge>
            <Badge variant="primary">Beta: {groupedCount.beta}</Badge>
          </div>
        </div>
      </Card>

      <Card className="border-border bg-surface p-4">
        <div className="flex flex-wrap gap-3 text-xs text-muted">
          {sectionSummary.map((item) => (
            <div key={item.section} className="rounded-lg border border-border bg-surface-alt px-3 py-2">
              {sections.find((section) => section.id === item.section)?.title ?? item.section}: {item.enabled}/{item.total}{' '}
              activas
            </div>
          ))}
        </div>
      </Card>

      {loading && (
        <Card className="border-border bg-surface p-8 text-center text-muted">
          <Loader2 className="mx-auto mb-2 animate-spin" size={20} />
          Cargando herramientas...
        </Card>
      )}

      {!loading && error && (
        <Card className="border-danger/30 bg-danger-soft p-6 text-danger">
          <p className="font-semibold">{error}</p>
        </Card>
      )}

      {!loading &&
        !error &&
        sections.map((section) => {
          const sectionApps = unifiedApps.filter((app) => app.section === section.id);
          if (sectionApps.length === 0) return null;

          return (
            <Card key={section.id} className="border-border bg-surface p-5">
              <div className="mb-5">
                <h2 className="text-lg font-semibold text-foreground">{section.title}</h2>
                <p className="text-sm text-muted">{section.description}</p>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {sectionApps.map((tool) => {
                  const runtimeBadge = availabilityBadge(tool);
                  const visibleInPanel = isEnabledInPanel(tool.id);
                  const runtimeStatus = appRuntimeStatus[tool.id]?.status ?? 'stopped';
                  const runtimePid = appRuntimeStatus[tool.id]?.pid ?? null;
                  const runtimeBlocked = !tool.runtime.enabled || tool.runtime.degraded;
                  const canOpen = visibleInPanel && Boolean(tool.path) && (runtimeStatus === 'running' || (tool.runtime.enabled && tool.available));

                  return (
                    <Card key={tool.id} className="border-border bg-surface-alt p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-base font-semibold text-foreground">{tool.name}</h3>
                          <p className="mt-1 text-sm text-muted">{tool.description}</p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Badge variant={statusVariant[tool.status]}>{tool.status}</Badge>
                          <Badge variant={runtimeBadge.variant}>{runtimeBadge.label}</Badge>
                          <Badge variant={runtimeStatusBadgeVariant[runtimeStatus]}>estado: {runtimeStatus}</Badge>
                          <Badge variant="neutral">PID: {runtimePid ?? '—'}</Badge>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <label className="mr-auto flex items-center gap-2 text-xs text-muted">
                          <Power size={14} />
                          <input
                            type="checkbox"
                            checked={visibleInPanel}
                            onChange={(event) => updateEnabledApp(tool.id, event.target.checked)}
                            className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                          />
                          Activar en panel
                        </label>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => executeAction(tool.id, 'install')}
                          disabled={!visibleInPanel || runtimeBlocked || runtimeStatus === 'installing' || runtimeStatus === 'starting'}
                        >
                          Instalar
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => executeAction(tool.id, 'start')}
                          disabled={!visibleInPanel || runtimeBlocked || runtimeStatus === 'running' || runtimeStatus === 'starting' || runtimeStatus === 'installing'}
                        >
                          Iniciar
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => executeAction(tool.id, 'stop')}
                          disabled={!visibleInPanel || runtimeStatus !== 'running'}
                        >
                          Parar
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => openLogs(tool.id)} disabled={!visibleInPanel}>
                          Ver logs
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => openApp(tool)} disabled={!canOpen}>
                          Abrir
                          <ArrowUpRight size={16} />
                        </Button>
                      </div>

                      {appErrors[tool.id] && <p className="mt-3 text-xs text-danger">{appErrors[tool.id]}</p>}
                      {tool.runtime.degraded && (
                        <p className="mt-2 text-xs text-warning">
                          Runtime degradado: esta app no puede iniciarse desde ToolsHub.
                        </p>
                      )}

                      <code className="mt-3 block rounded bg-surface px-2 py-1 text-xs text-muted">
                        {tool.path || 'Sin ruta pública (requiere manifest/configuración)'}
                      </code>
                    </Card>
                  );
                })}
              </div>
            </Card>
          );
        })}

      <Modal
        isOpen={Boolean(logsAppId)}
        onClose={() => setLogsAppId(null)}
        title={`Logs · ${unifiedApps.find((app) => app.id === logsAppId)?.name ?? ''}`}
        className="max-w-4xl border-border bg-surface"
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted">Tail inicial: 200 líneas</p>
            <Button variant="secondary" size="sm" onClick={() => logsAppId && refreshLogs(logsAppId)} disabled={logsLoading}>
              Refrescar
            </Button>
          </div>

          {logsLoading && (
            <div className="text-sm text-muted">
              <Loader2 className="mr-2 inline-block animate-spin" size={16} />
              Cargando logs...
            </div>
          )}

          {logsError && <p className="text-sm text-danger">{logsError}</p>}

          <pre className="max-h-[60vh] overflow-auto rounded border border-border bg-surface-alt p-3 text-xs text-foreground">
            {logsLines.length > 0 ? logsLines.join('\n') : 'Sin logs disponibles para esta app.'}
          </pre>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(pendingLegacyTool)}
        title="Estás abriendo una herramienta legacy"
        message={`La herramienta ${pendingLegacyTool?.name || ''} usa una UI de contexto diferente al SPA principal. ¿Deseas continuar?`}
        confirmLabel="Continuar"
        cancelLabel="Cancelar"
        isDestructive={false}
        onCancel={() => setPendingLegacyTool(null)}
        onConfirm={() => {
          if (pendingLegacyTool) {
            window.location.href = pendingLegacyTool.path;
          }
          setPendingLegacyTool(null);
        }}
      />

      {pendingLegacyTool && (
        <div className="fixed bottom-6 right-6 flex items-center gap-2 rounded-xl border border-warning/40 bg-warning-soft px-3 py-2 text-xs text-warning shadow-lg">
          <TriangleAlert size={14} />
          Cambio de contexto detectado (legacy)
        </div>
      )}
    </div>
  );
};

export default ToolsHub;

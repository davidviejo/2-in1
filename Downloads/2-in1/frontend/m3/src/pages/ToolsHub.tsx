import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Loader2, Power, TriangleAlert, Wrench } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { api, ToolCatalogItem } from '../services/api';

const statusVariant: Record<ToolCatalogItem['status'], 'warning' | 'success' | 'primary'> = {
  legacy: 'warning',
  migrada: 'success',
  beta: 'primary',
};

const availabilityBadge = (tool: ToolCatalogItem): { label: string; variant: 'danger' | 'warning' | 'success' } => {
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

type LauncherSection = 'apps-independientes' | 'frontend' | 'backend';

interface LauncherApp {
  id: string;
  name: string;
  description: string;
  path: string;
  section: LauncherSection;
  status?: ToolCatalogItem['status'];
  runtime: {
    enabled: boolean;
    degraded: boolean;
    requires_credentials: boolean;
  };
}

const FRONTEND_APPS: LauncherApp[] = [
  {
    id: 'frontend-dashboard',
    name: 'Frontend · Dashboard',
    description: 'Entrada principal del panel de gestión SEO para clientes.',
    path: '/app/',
    section: 'frontend',
    status: 'migrada',
    runtime: { enabled: true, degraded: false, requires_credentials: false },
  },
  {
    id: 'frontend-gsc-impact',
    name: 'Frontend · Impacto GSC',
    description: 'Vista de impacto por propiedad y portfolio en Search Console.',
    path: '/app/gsc-impact?view=global',
    section: 'frontend',
    status: 'beta',
    runtime: { enabled: true, degraded: false, requires_credentials: false },
  },
  {
    id: 'frontend-roadmap',
    name: 'Frontend · Roadmap',
    description: 'Planificación táctica y priorización de acciones por cliente.',
    path: '/app/client-roadmap',
    section: 'frontend',
    status: 'migrada',
    runtime: { enabled: true, degraded: false, requires_credentials: false },
  },
];

const BACKEND_APPS: LauncherApp[] = [
  {
    id: 'backend-operator',
    name: 'Backend · Operator Console',
    description: 'Consola para ejecución manual de operaciones internas.',
    path: '/operator',
    section: 'backend',
    status: 'migrada',
    runtime: { enabled: true, degraded: false, requires_credentials: true },
  },
  {
    id: 'backend-tools-catalog',
    name: 'Backend · API Tools Catalog',
    description: 'Endpoint JSON del catálogo de herramientas y estado runtime.',
    path: '/api/tools/catalog',
    section: 'backend',
    status: 'beta',
    runtime: { enabled: true, degraded: false, requires_credentials: false },
  },
];

const PANEL_STORAGE_KEY = 'tools_hub_enabled_apps';

const ToolsHub: React.FC = () => {
  const [tools, setTools] = useState<ToolCatalogItem[]>([]);
  const [enabledApps, setEnabledApps] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingLegacyTool, setPendingLegacyTool] = useState<ToolCatalogItem | null>(null);

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

    const loadTools = async () => {
      try {
        const res = await api.getToolsCatalog();
        if (mounted) {
          setTools(res.tools || []);
        }
      } catch {
        if (mounted) {
          setError('No se pudo cargar el catálogo de herramientas.');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadTools();
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

  const launcherApps = useMemo<LauncherApp[]>(() => {
    const independentApps: LauncherApp[] = tools.map((tool) => ({
      id: tool.id,
      name: tool.name,
      description: tool.description,
      path: tool.path,
      section: 'apps-independientes',
      status: tool.status,
      runtime: tool.runtime,
    }));
    return [...independentApps, ...FRONTEND_APPS, ...BACKEND_APPS];
  }, [tools]);

  const sections = useMemo(
    () => [
      {
        id: 'apps-independientes' as const,
        title: 'Apps independientes',
        description: 'Herramientas desacopladas y módulos legacy/migrados.',
      },
      {
        id: 'frontend' as const,
        title: 'Frontend',
        description: 'Entradas rápidas a vistas clave del SPA.',
      },
      {
        id: 'backend' as const,
        title: 'Backend',
        description: 'Consolas y endpoints operativos del servidor.',
      },
    ],
    [],
  );

  const isEnabledInPanel = (appId: string) => enabledApps[appId] ?? true;

  const updateEnabledApp = (appId: string, enabled: boolean) => {
    setEnabledApps((prev) => {
      const next = { ...prev, [appId]: enabled };
      localStorage.setItem(PANEL_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const openApp = (tool: LauncherApp) => {
    if (!tool.runtime.enabled || !isEnabledInPanel(tool.id)) {
      return;
    }
    if (tool.status === 'legacy') {
      setPendingLegacyTool({
        id: tool.id,
        name: tool.name,
        description: tool.description,
        path: tool.path,
        status: 'legacy',
        available: true,
        runtime: tool.runtime,
      });
      return;
    }
    window.location.href = tool.path;
  };

  const sectionSummary = useMemo(() => {
    return sections.map((section) => {
      const apps = launcherApps.filter((app) => app.section === section.id);
      const enabled = apps.filter((app) => isEnabledInPanel(app.id)).length;
      return { section: section.id, total: apps.length, enabled };
    });
  }, [launcherApps, sections, enabledApps]);

  return (
    <div className="space-y-6">
      <Card className="border-border bg-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted">Tools Hub</p>
            <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold text-foreground">
              <Wrench size={22} />
              Panel de Apps (sin unificar)
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-muted">
              Controla qué apps mostrar/activar por sección. El panel no fusiona apps: solo centraliza accesos
              para Apps independientes, Frontend y Backend.
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
              {item.section === 'apps-independientes'
                ? 'Apps independientes'
                : item.section === 'frontend'
                  ? 'Frontend'
                  : 'Backend'}
              : {item.enabled}/{item.total} activas
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
          const sectionApps = launcherApps.filter((app) => app.section === section.id);
          if (sectionApps.length === 0) return null;

          return (
            <Card key={section.id} className="border-border bg-surface p-5">
              <div className="mb-5">
                <h2 className="text-lg font-semibold text-foreground">{section.title}</h2>
                <p className="text-sm text-muted">{section.description}</p>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {sectionApps.map((tool) => {
                  const runtimeBadge =
                    section.id === 'apps-independientes'
                      ? availabilityBadge({
                          id: tool.id,
                          name: tool.name,
                          path: tool.path,
                          status: tool.status ?? 'migrada',
                          description: tool.description,
                          available: true,
                          runtime: tool.runtime,
                        })
                      : !tool.runtime.enabled
                        ? { label: 'Deshabilitada', variant: 'danger' as const }
                        : tool.runtime.requires_credentials
                          ? { label: 'Requiere credenciales', variant: 'warning' as const }
                          : { label: 'Disponible', variant: 'success' as const };
                  const visibleInPanel = isEnabledInPanel(tool.id);

                  return (
                    <Card key={tool.id} className="border-border bg-surface-alt p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-base font-semibold text-foreground">{tool.name}</h3>
                          <p className="mt-1 text-sm text-muted">{tool.description}</p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {tool.status && <Badge variant={statusVariant[tool.status]}>{tool.status}</Badge>}
                          <Badge variant={runtimeBadge.variant}>{runtimeBadge.label}</Badge>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center justify-between gap-2">
                        <label className="flex items-center gap-2 text-xs text-muted">
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
                          onClick={() => openApp(tool)}
                          disabled={!tool.runtime.enabled || !visibleInPanel}
                        >
                          Abrir
                          <ArrowUpRight size={16} />
                        </Button>
                      </div>
                      <code className="mt-3 block rounded bg-surface px-2 py-1 text-xs text-muted">{tool.path}</code>
                    </Card>
                  );
                })}
              </div>
            </Card>
          );
        })}

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

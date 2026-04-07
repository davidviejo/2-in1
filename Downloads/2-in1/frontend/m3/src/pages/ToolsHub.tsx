import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Loader2, TriangleAlert, Wrench } from 'lucide-react';
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

const ToolsHub: React.FC = () => {
  const [tools, setTools] = useState<ToolCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingLegacyTool, setPendingLegacyTool] = useState<ToolCatalogItem | null>(null);

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

  const openTool = (tool: ToolCatalogItem) => {
    if (tool.status === 'legacy') {
      setPendingLegacyTool(tool);
      return;
    }
    window.location.href = tool.path;
  };

  return (
    <div className="space-y-6">
      <Card className="border-border bg-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted">Tools Hub</p>
            <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold text-foreground">
              <Wrench size={22} />
              Catálogo de herramientas
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-muted">
              Punto único para herramientas legacy y módulos migrados. Las herramientas legacy
              mostrarán advertencia por cambio de contexto/UI antes de abrirse.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="warning">Legacy: {groupedCount.legacy}</Badge>
            <Badge variant="success">Migrada: {groupedCount.migrada}</Badge>
            <Badge variant="primary">Beta: {groupedCount.beta}</Badge>
          </div>
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

      {!loading && !error && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {tools.map((tool) => (
            <Card key={tool.id} className="border-border bg-surface p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{tool.name}</h2>
                  <p className="mt-1 text-sm text-muted">{tool.description}</p>
                </div>
                <Badge variant={statusVariant[tool.status]}>{tool.status}</Badge>
              </div>
              <div className="mt-5 flex items-center justify-between">
                <code className="rounded bg-surface-alt px-2 py-1 text-xs text-muted">{tool.path}</code>
                <Button variant="secondary" onClick={() => openTool(tool)}>
                  Abrir
                  <ArrowUpRight size={16} />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

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

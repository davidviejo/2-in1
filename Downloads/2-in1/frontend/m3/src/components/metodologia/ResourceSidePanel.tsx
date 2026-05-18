import React from 'react';
import { Copy, Edit3, ExternalLink, Share2, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

type ResourceStatus = 'Completado' | 'En progreso' | 'Pendiente';

export type MetodologiaResource = {
  id: string;
  title: string;
  type: string;
  meta: string;
  moduleId: string;
  description: string;
  updatedAt: string;
  owner: string;
  status: ResourceStatus;
  metadata: Array<{ label: string; value: string }>;
  quickNotes: string[];
};

type ResourceSidePanelProps = {
  resource: MetodologiaResource | null;
  onClose: () => void;
  onOpen: (resource: MetodologiaResource) => void;
  onShare: (resource: MetodologiaResource) => void;
  onCopy: (resource: MetodologiaResource) => void;
  onEdit: (resource: MetodologiaResource) => void;
  onDelete: (resource: MetodologiaResource) => void;
};

const statusVariant: Record<ResourceStatus, 'success' | 'warning' | 'default'> = {
  Completado: 'success',
  'En progreso': 'warning',
  Pendiente: 'default',
};

const ResourceSidePanel: React.FC<ResourceSidePanelProps> = ({
  resource,
  onClose,
  onOpen,
  onShare,
  onCopy,
  onEdit,
  onDelete,
}) => {
  return (
    <aside
      className={`fixed right-0 top-0 z-40 h-full w-full max-w-md transform border-l border-slate-200 bg-white p-5 shadow-2xl transition-transform duration-200 ${resource ? 'translate-x-0' : 'translate-x-full'}`}
      aria-hidden={!resource}
    >
      {resource ? (
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Detalle del recurso</p>
              <h3 className="mt-1 text-lg font-semibold text-slate-900">{resource.title}</h3>
              <p className="text-sm text-slate-500">{resource.type} · {resource.updatedAt}</p>
            </div>
            <button type="button" onClick={onClose} title="Cerrar panel" className="rounded-md p-1 text-slate-500 transition hover:bg-slate-100">
              <X size={18} />
            </button>
          </div>

          <div className="mt-4 flex-1 space-y-5 overflow-y-auto">
            <section className="space-y-2">
              <h4 className="text-sm font-semibold text-slate-900">Metadata</h4>
              <div className="rounded-xl border border-slate-200 p-3 text-sm text-slate-700">
                <p><span className="font-semibold">Módulo:</span> {resource.moduleId}</p>
                <p><span className="font-semibold">Responsable:</span> {resource.owner}</p>
                <p><span className="font-semibold">Descripción:</span> {resource.description}</p>
                {resource.metadata.map((item) => (
                  <p key={item.label}><span className="font-semibold">{item.label}:</span> {item.value}</p>
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <h4 className="text-sm font-semibold text-slate-900">Estado y módulo asociado</h4>
              <div className="flex items-center gap-2">
                <Badge variant={statusVariant[resource.status]}>{resource.status}</Badge>
                <Badge variant="info">{resource.moduleId}</Badge>
              </div>
            </section>

            <section className="space-y-2">
              <h4 className="text-sm font-semibold text-slate-900">Acciones</h4>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={() => onOpen(resource)} className="justify-start"><ExternalLink size={14} />Abrir</Button>
                <Button variant="secondary" onClick={() => onShare(resource)} className="justify-start"><Share2 size={14} />Compartir</Button>
                <Button variant="secondary" onClick={() => onCopy(resource)} className="justify-start"><Copy size={14} />Copiar</Button>
                <Button variant="secondary" onClick={() => onEdit(resource)} className="justify-start"><Edit3 size={14} />Editar</Button>
                <Button variant="danger" onClick={() => onDelete(resource)} className="col-span-2 justify-start"><Trash2 size={14} />Eliminar</Button>
              </div>
            </section>

            <section className="space-y-2">
              <h4 className="text-sm font-semibold text-slate-900">Notas rápidas</h4>
              <div className="space-y-2 rounded-xl border border-slate-200 p-3 text-sm text-slate-700">
                {resource.quickNotes.map((note) => (
                  <p key={note}>• {note}</p>
                ))}
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </aside>
  );
};

export default ResourceSidePanel;

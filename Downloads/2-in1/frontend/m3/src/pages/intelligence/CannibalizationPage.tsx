import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/ToastContext';
import { useGSCData } from '@/hooks/useGSCData';
import {
  createOpportunityFromCannibalization,
  getCannibalizationIssues,
  loadPersistedCannibalizationIssues,
  persistCannibalizationIssues,
} from '@/features/intelligence/cannibalization/service';
import { CannibalizationIssue } from '@/features/intelligence/cannibalization/types';

const projectId = 'default-project';

export default function CannibalizationPage() {
  const { success, info } = useToast();
  const { data } = useGSCData();
  const [issues, setIssues] = useState<CannibalizationIssue[]>(() => loadPersistedCannibalizationIssues(projectId));
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<CannibalizationIssue | null>(null);

  const analyze = () => {
    const detected = getCannibalizationIssues(projectId, data.rows);
    const merged = [...detected, ...issues.filter((x) => x.sourceModule === 'manual')];
    setIssues(merged);
    persistCannibalizationIssues(projectId, merged);
    success(`Análisis completado: ${merged.length} conflictos.`);
  };

  const filtered = useMemo(() => issues.filter((i) => (i.title + i.query + i.cluster).toLowerCase().includes(search.toLowerCase())), [issues, search]);
  const critical = filtered.filter((i) => i.severity === 'critical').length;

  const updateStatus = (id: string, status: CannibalizationIssue['status']) => {
    const next = issues.map((i) => (i.id === id ? { ...i, status, updatedAt: new Date().toISOString() } : i));
    setIssues(next);
    persistCannibalizationIssues(projectId, next);
  };

  return <div className="space-y-4 p-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="section-title">Cannibalization</h1>
        <p className="text-sm text-muted">Detecta conflictos entre URLs que compiten por las mismas queries o intención y conviértelos en acciones.</p>
      </div>
      <div className="flex gap-2"><Button onClick={analyze}>Analizar canibalización</Button></div>
    </div>

    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Card className="p-3"><p className="text-xs text-muted">Conflictos detectados</p><p className="text-2xl font-semibold">{filtered.length}</p></Card>
      <Card className="p-3"><p className="text-xs text-muted">Conflictos críticos</p><p className="text-2xl font-semibold">{critical}</p></Card>
      <Card className="p-3"><p className="text-xs text-muted">Queries afectadas</p><p className="text-2xl font-semibold">{new Set(filtered.map((x) => x.query).filter(Boolean)).size}</p></Card>
      <Card className="p-3"><p className="text-xs text-muted">URLs afectadas</p><p className="text-2xl font-semibold">{filtered.reduce((a, b) => a + b.urlCount, 0)}</p></Card>
    </div>

    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por query, cluster o URL" className="max-w-md" />
        <p className="text-xs text-muted">Fuente: {data.rows.length ? 'real' : 'fallback local/mock'}</p>
      </div>
      <div className="overflow-auto">
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b border-border"><th>Conflicto</th><th>Query</th><th>URL ganadora</th><th>URLs</th><th>Severidad</th><th>Score</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>{filtered.map((i) => <tr key={i.id} className="border-b border-border/50">
            <td className="py-2">{i.title}</td><td>{i.query || '—'}</td><td>{i.winningUrl || '—'}</td><td>{i.urlCount}</td><td>{i.severity}</td><td>{i.score}</td><td>{i.status}</td>
            <td><div className="flex flex-wrap gap-1"><Button size="sm" variant="secondary" onClick={() => setSelected(i)}>Detalle</Button><Button size="sm" onClick={() => { createOpportunityFromCannibalization(i); updateStatus(i.id, 'opportunity_created'); success('Oportunidad creada.'); }}>Crear oportunidad</Button><Button size="sm" variant="ghost" onClick={() => { updateStatus(i.id, 'reviewed'); info('Marcado como revisado.'); }}>Revisado</Button></div></td>
          </tr>)}</tbody>
        </table>
      </div>
      {filtered.length === 0 && <p className="py-8 text-center text-sm text-muted">No hay conflictos detectados. Ejecuta un análisis.</p>}
    </Card>

    <Modal isOpen={!!selected} onClose={() => setSelected(null)} title={selected?.title} className="max-w-4xl">
      {selected && <div className="space-y-3 text-sm"><p><strong>Tipo:</strong> {selected.type}</p><p><strong>Estado:</strong> {selected.status}</p><p><strong>Recomendación:</strong> {selected.recommendation}</p><p><strong>Evidencia:</strong></p><ul className="list-disc pl-5">{selected.evidence.map((e) => <li key={e}>{e}</li>)}</ul><p><strong>URLs comparadas:</strong></p><div className="space-y-2">{selected.affectedUrls.map((u) => <Card key={u.url} className="p-3"><p>{u.url}</p><p className="text-xs text-muted">Clicks: {u.clicks ?? 'no disponible'} · Impr: {u.impressions ?? 'no disponible'} · Posición: {u.position ?? 'no disponible'}</p></Card>)}</div></div>}
    </Modal>
  </div>;
}

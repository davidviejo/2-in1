import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProject } from '@/context/ProjectContext';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/ToastContext';
import { detectSuggestions, InternalLinkSuggestion, loadSuggestions, saveSuggestions, typeLabel } from '@/features/intelligence/internal-linking';

const statusColor: Record<string, string> = { new: 'bg-blue-100 text-blue-800', approved: 'bg-emerald-100 text-emerald-800', rejected: 'bg-rose-100 text-rose-800', dismissed: 'bg-slate-100 text-slate-700', sent_to_task: 'bg-amber-100 text-amber-800', sent_to_roadmap: 'bg-purple-100 text-purple-800', opportunity_created: 'bg-cyan-100 text-cyan-800' };

export default function InternalLinkingPage() {
  const { currentClient, currentClientId, clients, switchClient, modules, addTask, toggleCustomRoadmapTask } = useProject();
  const { success, info } = useToast();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<'7'|'28'|'90'>('28');
  const [mode, setMode] = useState<'suggestions'|'target'|'cluster'|'issues'>('suggestions');
  const [q, setQ] = useState('');
  const [tick, setTick] = useState(0);

  const suggestions = useMemo(() => {
    const persisted = currentClientId ? loadSuggestions(currentClientId) : [];
    return persisted.length ? persisted : detectSuggestions(currentClient, modules);
  }, [currentClient, currentClientId, modules, tick]);

  const filtered = suggestions.filter((s) => `${s.title} ${s.sourceUrl} ${s.targetUrl} ${s.suggestedAnchor}`.toLowerCase().includes(q.toLowerCase()));
  const kpi = { total: filtered.length, quickWins: filtered.filter((s) => s.score >= 70 && s.effort === 'low' && !['dismissed','rejected'].includes(s.status)).length, orphan: filtered.filter((s) => s.type === 'orphan_url').length, broken: filtered.filter((s) => s.type === 'internal_broken_link').length, conflicts: filtered.filter((s) => s.type === 'anchor_conflict').length, tasks: filtered.filter((s) => s.status === 'sent_to_task').length, roadmap: filtered.filter((s) => s.status === 'sent_to_roadmap').length };

  const persistUpdate = (id: string, patch: Partial<InternalLinkSuggestion>) => {
    if (!currentClientId) return;
    const next = suggestions.map((s) => s.id === id ? { ...s, ...patch, updatedAt: new Date().toISOString() } : s);
    saveSuggestions(currentClientId, next);
    setTick((v) => v + 1);
  };

  const createTask = (s: InternalLinkSuggestion) => {
    const moduleId = modules.find((m) => m.isCustom)?.id || modules[0]?.id;
    if (!moduleId) return;
    addTask(moduleId, `[Internal Linking] ${s.title}`, `${s.recommendation}\n\nOrigen: ${s.sourceUrl}\nDestino: ${s.targetUrl}\nAnchor: ${s.suggestedAnchor}`, s.impact === 'high' ? 'High' : s.impact === 'medium' ? 'Medium' : 'Low', 'Internal Linking', { status: 'pending', isInCustomRoadmap: true });
    persistUpdate(s.id, { status: 'sent_to_task' });
    success('Tarea creada en Kanban.');
  };

  const sendRoadmap = (s: InternalLinkSuggestion) => {
    const moduleId = modules.find((m) => m.isCustom)?.id || modules[0]?.id;
    const taskId = modules.find((m) => m.id === moduleId)?.tasks[0]?.id;
    if (moduleId && taskId) toggleCustomRoadmapTask(moduleId, taskId);
    persistUpdate(s.id, { status: 'sent_to_roadmap' });
    info('Marcada para roadmap.');
  };

  const createOpportunity = (s: InternalLinkSuggestion) => {
    const key = `agenciaseo:opportunities:${currentClientId}`;
    const curr = JSON.parse(localStorage.getItem(key) || '[]');
    curr.unshift({ id: `il-${s.id}`, title: s.title, type: 'internal_linking', urlOrCluster: s.targetUrl || s.cluster || s.sourceUrl, score: { total: s.score }, confidence: s.confidence / 100, effort: s.effort === 'low' ? 2 : s.effort === 'medium' ? 3 : 4, priority: s.severity, sourceModule: 'internal_linking' });
    localStorage.setItem(key, JSON.stringify(curr));
    persistUpdate(s.id, { status: 'opportunity_created' });
    success('Oportunidad creada en inventario.');
  };

  return <div className='p-4 space-y-4'>
    <div className='flex flex-wrap items-center justify-between gap-3'><div><h1 className='section-title'>Internal Linking</h1><p className='section-subtitle'>Detecta oportunidades de enlazado interno para reforzar URLs, clusters y páginas de negocio.</p></div>
      <div className='flex gap-2 flex-wrap'>
        <select className='input' value={currentClientId} onChange={(e) => switchClient(e.target.value)}>{clients.map((c)=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select className='input' value={period} onChange={(e)=>setPeriod(e.target.value as any)}><option value='7'>7 días</option><option value='28'>28 días</option><option value='90'>90 días</option></select>
        <select className='input' value={mode} onChange={(e)=>setMode(e.target.value as any)}><option value='suggestions'>Por sugerencias</option><option value='target'>Por URL destino</option><option value='cluster'>Por cluster</option><option value='issues'>Por issues</option></select>
        <Button onClick={()=>{ if(currentClientId) saveSuggestions(currentClientId, detectSuggestions(currentClient, modules)); setTick((v)=>v+1); }}>Analizar enlaces internos</Button>
      </div></div>
    <div className='grid md:grid-cols-4 gap-3 card p-3 text-sm'><div>Sugerencias <div className='text-xl font-bold'>{kpi.total}</div></div><div>Quick wins <div className='text-xl font-bold'>{kpi.quickWins}</div></div><div>URLs huérfanas <div className='text-xl font-bold'>{kpi.orphan}</div></div><div>Enlaces rotos <div className='text-xl font-bold'>{kpi.broken}</div></div><div>Conflictos anchor <div className='text-xl font-bold'>{kpi.conflicts}</div></div><div>Tareas creadas <div className='text-xl font-bold'>{kpi.tasks}</div></div><div>Roadmap enviados <div className='text-xl font-bold'>{kpi.roadmap}</div></div><div>Data mode <div className='text-xl font-bold'>{suggestions.some((s)=>s.dataMode==='real') ? 'real/parcial' : 'mock'}</div></div></div>
    <input className='input w-full' placeholder='Buscar por URL, anchor o sugerencia...' value={q} onChange={(e)=>setQ(e.target.value)} />
    <div className='card overflow-auto'><table className='w-full text-sm'><thead><tr className='text-left border-b'><th>Sugerencia</th><th>Tipo</th><th>Origen</th><th>Destino</th><th>Anchor</th><th>Score</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{filtered.map((s)=><tr key={s.id} className='border-b align-top'><td className='py-2'>{s.title}</td><td><Badge>{typeLabel[s.type]}</Badge></td><td>{s.sourceUrl || '-'}</td><td>{s.targetUrl || '-'}</td><td>{s.suggestedAnchor || '-'}</td><td>{s.score}</td><td><span className={`px-2 py-1 rounded ${statusColor[s.status] || ''}`}>{s.status}</span></td><td className='space-x-1'><Button variant='ghost' onClick={()=>persistUpdate(s.id,{status:'approved'})}>Aprobar</Button><Button variant='ghost' onClick={()=>persistUpdate(s.id,{status:'rejected'})}>Rechazar</Button><Button variant='ghost' onClick={()=>createTask(s)}>Crear tarea</Button><Button variant='ghost' onClick={()=>createOpportunity(s)}>Crear oportunidad</Button><Button variant='ghost' onClick={()=>sendRoadmap(s)}>Roadmap</Button></td></tr>)}</tbody></table></div>
    <div className='flex gap-2'><Button variant='secondary' onClick={()=>navigate('/app/opportunities')}>Ir a Opportunities</Button><Button variant='secondary' onClick={()=>navigate('/app/cannibalization')}>Ir a Cannibalization</Button><Button variant='secondary' onClick={()=>navigate('/app/kanban')}>Ir a Kanban</Button></div>
  </div>;
}

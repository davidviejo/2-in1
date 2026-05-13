import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/intelligence/IntelligenceUI';
import { useProject } from '@/context/ProjectContext';
import { useToast } from '@/components/ui/ToastContext';

type SerpSignalStatus = 'new' | 'reviewed' | 'dismissed' | 'opportunity_created' | 'sent_to_task' | 'sent_to_roadmap' | 'brief_generated' | 'monitoring' | 'won' | 'lost';
type DataMode = 'real' | 'partial' | 'mock';

type Signal = {
  id: string;
  keyword: string;
  cluster: string;
  intent: 'informational' | 'commercial' | 'transactional' | 'local' | 'mixed';
  targetUrl?: string;
  currentPosition?: number;
  previousPosition?: number;
  impressions?: number;
  clicks?: number;
  ctr?: number;
  serpFeatures: string[];
  dominantFormat: string;
  competitor?: string;
  aiBrandMentioned?: boolean;
  aiOwnUrlCited?: boolean;
  status: SerpSignalStatus;
  score: number;
  dataMode: DataMode;
  recommendation: string;
  reason: string;
};

const STORAGE_PREFIX = 'agenciaseo:serp-ai:signals:';
const OPPORTUNITIES_KEY = 'mediaflow_serp_ai_opportunities_v1';
const BRIEFS_KEY = 'mediaflow_serp_ai_briefs_v1';

const fromStorage = (clientId: string): Signal[] => {
  try {
    return JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}${clientId}`) || '[]');
  } catch {
    return [];
  }
};

const toStorage = (clientId: string, signals: Signal[]) => localStorage.setItem(`${STORAGE_PREFIX}${clientId}`, JSON.stringify(signals));

const inferScore = (s: Partial<Signal>) => {
  const pos = s.currentPosition || 100;
  const impressions = s.impressions || 0;
  const ctr = s.ctr || 0;
  const featureGap = (s.serpFeatures || []).length > 0 ? 15 : 0;
  const posScore = pos <= 10 ? 80 : pos <= 20 ? 70 : 50;
  const volScore = impressions > 1000 ? 10 : impressions > 200 ? 6 : 2;
  const ctrScore = ctr < 0.02 ? 12 : ctr < 0.04 ? 8 : 3;
  const aiGap = s.aiBrandMentioned === false ? 10 : 0;
  return Math.min(100, posScore + volScore + ctrScore + featureGap + aiGap);
};

const seedSignals = (): Signal[] => ([
  { id: crypto.randomUUID(), keyword: 'software seo para agencias', cluster: 'saas seo', intent: 'commercial', targetUrl: '/software-seo', currentPosition: 9, previousPosition: 13, impressions: 2200, clicks: 41, ctr: 0.018, serpFeatures: ['featured_snippet', 'people_also_ask'], dominantFormat: 'comparativa', competitor: 'semrush.com', aiBrandMentioned: false, aiOwnUrlCited: false, status: 'new', score: 88, dataMode: 'partial', recommendation: 'Crear sección comparativa + FAQ + schema FAQ.', reason: 'Top10 con CTR bajo y features no capturadas.' },
  { id: crypto.randomUUID(), keyword: 'auditoria seo local', cluster: 'seo local', intent: 'local', targetUrl: '/auditoria-seo-local', currentPosition: 15, previousPosition: 10, impressions: 980, clicks: 20, ctr: 0.02, serpFeatures: ['local_pack', 'reviews'], dominantFormat: 'página local', competitor: 'seoclarity.com', aiBrandMentioned: true, aiOwnUrlCited: false, status: 'monitoring', score: 82, dataMode: 'partial', recommendation: 'Refuerzo de enlazado interno + bloques de experiencia local.', reason: 'Caída de posición en keyword local estratégica.' },
]);

export default function SerpAiMonitorPage() {
  const { currentClient, currentClientId, clients, switchClient, addTask, modules, toggleCustomRoadmapTask } = useProject();
  const { success, info } = useToast();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<'7' | '28' | '90'>('28');
  const [mode, setMode] = useState<'keywords' | 'features' | 'ai' | 'competitors' | 'opportunities'>('keywords');
  const [statusFilter, setStatusFilter] = useState<'all' | SerpSignalStatus>('all');
  const [query, setQuery] = useState('');
  const [tick, setTick] = useState(0);

  const signals = useMemo(() => {
    const existing = fromStorage(currentClientId);
    if (existing.length) return existing;
    const seeded = seedSignals();
    toStorage(currentClientId, seeded);
    return seeded;
  }, [currentClientId, tick]);

  const filtered = signals.filter((s) => (statusFilter === 'all' || s.status === statusFilter) && (!query || s.keyword.toLowerCase().includes(query.toLowerCase())));

  const summary = useMemo(() => ({
    monitoredKeywords: signals.length,
    top3: signals.filter((s) => (s.currentPosition || 99) <= 3).length,
    top10: signals.filter((s) => (s.currentPosition || 99) <= 10).length,
    pos11to20: signals.filter((s) => (s.currentPosition || 99) >= 11 && (s.currentPosition || 99) <= 20).length,
    featuresDetected: signals.reduce((acc, s) => acc + s.serpFeatures.length, 0),
    uncaptured: signals.filter((s) => s.serpFeatures.length > 0 && !s.aiOwnUrlCited).length,
    brandPresence: signals.length ? Math.round((signals.filter((s) => s.aiBrandMentioned).length / signals.length) * 100) : 0,
  }), [signals]);

  const mutateSignal = (id: string, update: Partial<Signal>) => {
    const next = signals.map((s) => (s.id === id ? { ...s, ...update } : s));
    toStorage(currentClientId, next);
    setTick((v) => v + 1);
  };

  const createTaskFromSignal = (s: Signal) => {
    const moduleId = modules[0]?.id;
    if (!moduleId) return;
    addTask(moduleId, `[SERP/AI] ${s.keyword}`, `${s.recommendation}\n\nMotivo: ${s.reason}`, s.score >= 80 ? 'High' : s.score >= 65 ? 'Medium' : 'Low', 'SERP & AI Visibility', { status: 'pending', isInCustomRoadmap: true });
    mutateSignal(s.id, { status: 'sent_to_task' });
    success('Tarea creada en Kanban.');
  };

  const sendToRoadmap = (s: Signal) => {
    createTaskFromSignal(s);
    const moduleId = modules[0]?.id;
    const taskId = modules[0]?.tasks?.[0]?.id;
    if (moduleId && taskId) toggleCustomRoadmapTask(moduleId, taskId);
    mutateSignal(s.id, { status: 'sent_to_roadmap' });
    info('Señal enviada a roadmap (vía tarea).');
  };

  const createOpportunity = (s: Signal) => {
    const existing = JSON.parse(localStorage.getItem(OPPORTUNITIES_KEY) || '[]');
    existing.push({ id: crypto.randomUUID(), title: `[SERP/AI] ${s.keyword}`, type: 'serp_feature', sourceModule: 'serp_ai_visibility', sourceId: s.id, score: s.score, status: 'new', recommendation: s.recommendation, reason: s.reason, createdAt: new Date().toISOString() });
    localStorage.setItem(OPPORTUNITIES_KEY, JSON.stringify(existing));
    mutateSignal(s.id, { status: 'opportunity_created' });
    success('Oportunidad creada (adapter local, TODO: integrar repositorio real).');
  };

  const generateBrief = (s: Signal) => {
    const briefs = JSON.parse(localStorage.getItem(BRIEFS_KEY) || '[]');
    briefs.push({ id: crypto.randomUUID(), keyword: s.keyword, cluster: s.cluster, targetUrl: s.targetUrl, dominantFormat: s.dominantFormat, featureTarget: s.serpFeatures[0] || 'organic', uniqueValueRequired: ['experiencia real', 'datos propios', 'comparativa útil'], createdAt: new Date().toISOString(), recommendation: s.recommendation });
    localStorage.setItem(BRIEFS_KEY, JSON.stringify(briefs));
    mutateSignal(s.id, { status: 'brief_generated' });
    success('Brief generado (adapter local, TODO: conectar Content Briefs).');
  };

  return (
    <div className='space-y-4 p-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div><h1 className='section-title'>SERP & AI Visibility</h1><p className='section-subtitle'>Monitoriza presencia orgánica, SERP features, competidores y visibilidad en resultados con IA.</p></div>
        <div className='flex flex-wrap gap-2'>
          <select className='input' value={currentClientId} onChange={(e) => switchClient(e.target.value)}>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <select className='input' value={period} onChange={(e) => setPeriod(e.target.value as any)}><option value='7'>7 días</option><option value='28'>28 días</option><option value='90'>90 días</option></select>
          <select className='input' value={mode} onChange={(e) => setMode(e.target.value as any)}><option value='keywords'>Keywords</option><option value='features'>SERP Features</option><option value='ai'>AI Visibility</option><option value='competitors'>Competidores</option><option value='opportunities'>Oportunidades</option></select>
          <Button onClick={() => setTick((v) => v + 1)}>Actualizar monitorización</Button>
          <Button variant='secondary' onClick={() => { const kw = prompt('Keyword'); if (!kw) return; const ns: Signal = { id: crypto.randomUUID(), keyword: kw, cluster: 'manual', intent: 'mixed', status: 'new', serpFeatures: [], dominantFormat: 'guía', score: 60, dataMode: 'mock', recommendation: 'Completar datos e integrar con GSC.', reason: 'Keyword añadida manualmente.' }; const next = [...signals, ns].map((s) => ({ ...s, score: inferScore(s) })); toStorage(currentClientId, next); setTick((v) => v + 1); }}>Añadir keyword</Button>
        </div>
      </div>

      <div className='card p-4 grid gap-3 md:grid-cols-4'>
        <div>Keywords monitorizadas<div className='text-2xl font-semibold'>{summary.monitoredKeywords}</div></div>
        <div>Top 10<div className='text-2xl font-semibold'>{summary.top10}</div></div>
        <div>Posición 11-20<div className='text-2xl font-semibold'>{summary.pos11to20}</div></div>
        <div>Presencia de marca IA<div className='text-2xl font-semibold'>{summary.brandPresence}%</div></div>
      </div>

      <div className='card p-4 flex flex-wrap gap-2 items-center'>
        <input className='input' placeholder='Buscar keyword...' value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className='input' value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}><option value='all'>Todos</option><option value='new'>new</option><option value='reviewed'>reviewed</option><option value='dismissed'>dismissed</option><option value='monitoring'>monitoring</option><option value='won'>won</option><option value='lost'>lost</option></select>
        <Badge>Data mode: {signals.some((s) => s.dataMode === 'partial') ? 'partial' : 'mock'}</Badge>
        <Badge>Proyecto: {currentClient?.name || 'N/A'}</Badge>
      </div>

      {filtered.length === 0 ? <EmptyState title='No hay keywords o señales SERP/IA monitorizadas todavía. Añade keywords, importa señales o conecta fuentes para empezar.' /> : (
        <div className='card overflow-auto'>
          <table className='w-full text-sm'>
            <thead><tr className='text-left'><th className='p-2'>Keyword</th><th>Cluster</th><th>Pos.</th><th>Δ</th><th>CTR</th><th>Features</th><th>Competidor</th><th>AI</th><th>Score</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className='border-t border-slate-200/30'>
                  <td className='p-2'>{s.keyword}<div className='text-xs text-muted'>{s.targetUrl || 'sin URL'}</div></td><td>{s.cluster}</td><td>{s.currentPosition || '-'}</td><td>{(s.previousPosition && s.currentPosition) ? s.previousPosition - s.currentPosition : '-'}</td><td>{s.ctr ? `${(s.ctr * 100).toFixed(2)}%` : '-'}</td><td>{s.serpFeatures.join(', ') || '-'}</td><td>{s.competitor || '-'}</td><td>{s.aiBrandMentioned ? 'Marca sí' : 'Marca no'}</td><td><Badge>Score {s.score}</Badge></td><td>{s.status}</td>
                  <td><div className='flex flex-wrap gap-1 py-1'>
                    <Button size='sm' variant='secondary' onClick={() => createOpportunity(s)}>Oportunidad</Button>
                    <Button size='sm' onClick={() => createTaskFromSignal(s)}>Tarea</Button>
                    <Button size='sm' variant='secondary' onClick={() => sendToRoadmap(s)}>Roadmap</Button>
                    <Button size='sm' variant='secondary' onClick={() => generateBrief(s)}>Brief</Button>
                    <Button size='sm' variant='ghost' onClick={() => mutateSignal(s.id, { status: 'reviewed' })}>Revisada</Button>
                    <Button size='sm' variant='ghost' onClick={() => mutateSignal(s.id, { status: 'dismissed' })}>Descartar</Button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className='flex gap-2'>
        <Button variant='ghost' onClick={() => navigate('/app/opportunities')}>Ir a Opportunities</Button>
        <Button variant='ghost' onClick={() => navigate('/app/kanban')}>Ir a Kanban</Button>
        <Button variant='ghost' onClick={() => navigate('/app/client-roadmap')}>Ir a Roadmap</Button>
      </div>
    </div>
  );
}

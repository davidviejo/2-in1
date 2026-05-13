import { useMemo, useState } from 'react';
import { useProject } from '@/context/ProjectContext';
import { mockOpportunities } from '@/data/intelligenceMocks';
import type { Task } from '@/types';

type OpportunityType =
  | 'traffic_drop' | 'impression_drop' | 'ctr_low' | 'position_4_20' | 'keyword_gap' | 'content_refresh'
  | 'technical_issue' | 'indexation_issue' | 'internal_linking' | 'cannibalization' | 'schema_opportunity'
  | 'serp_feature' | 'ai_visibility' | 'blocked_task' | 'impact_pending' | 'roadmap_gap'
  | 'cluster_opportunity' | 'content_brief_needed';
type OpportunityStatus = 'new' | 'reviewed' | 'dismissed' | 'sent_to_task' | 'sent_to_roadmap' | 'brief_generated' | 'in_progress' | 'completed' | 'measuring_impact';
type Level = 'low' | 'medium' | 'high';

type SeoOpportunity = {
  id: string; projectId: string; title: string; type: OpportunityType; sourceModule: string; targetType: 'url'|'query'|'cluster'|'task'|'module'|'project';
  target: string; url?: string; query?: string; score: number; scoreBreakdown: { impactScore: number; confidenceScore: number; easeScore: number; businessValueScore: number; urgencyScore: number; };
  impact: Level; confidence: number; effort: Level; urgency: Level; businessValue: number; reason: string; recommendation: string; status: OpportunityStatus; dataMode: 'real'|'partial'|'mock'; createdAt: string; updatedAt: string;
};

const STORAGE_PREFIX = 'agenciaseo:opportunities:';
const typeLabel: Record<OpportunityType, string> = {
  traffic_drop: 'Caída de tráfico', impression_drop: 'Caída de impresiones', ctr_low: 'CTR bajo', position_4_20: 'Keyword posición 4-20', keyword_gap: 'Gap de keywords', content_refresh: 'Actualización de contenido', technical_issue: 'Issue técnico', indexation_issue: 'Problema de indexación', internal_linking: 'Enlazado interno', cannibalization: 'Canibalización', schema_opportunity: 'Oportunidad schema', serp_feature: 'SERP feature', ai_visibility: 'Visibilidad IA', blocked_task: 'Tarea bloqueada', impact_pending: 'Impacto pendiente de medir', roadmap_gap: 'Gap de roadmap', cluster_opportunity: 'Oportunidad de cluster', content_brief_needed: 'Brief pendiente'
};
const toScore = (impact: Level, confidence: number, effort: Level, businessValue: number, urgency: Level) => {
  const impactScore = impact === 'high' ? 90 : impact === 'medium' ? 60 : 30;
  const easeScore = effort === 'low' ? 90 : effort === 'medium' ? 60 : 30;
  const urgencyScore = urgency === 'high' ? 90 : urgency === 'medium' ? 60 : 30;
  const total = Math.round(impactScore * 0.3 + confidence * 0.2 + easeScore * 0.2 + businessValue * 0.2 + urgencyScore * 0.1);
  return { total, impactScore, confidenceScore: confidence, easeScore, businessValueScore: businessValue, urgencyScore };
};

const mapMock = (): SeoOpportunity[] => mockOpportunities.map((m) => {
  const impact: Level = m.score.impact >= 80 ? 'high' : m.score.impact >= 50 ? 'medium' : 'low';
  const urgency: Level = m.score.urgency >= 80 ? 'high' : m.score.urgency >= 50 ? 'medium' : 'low';
  const effort: Level = m.effort <= 2 ? 'low' : m.effort <= 3 ? 'medium' : 'high';
  const score = toScore(impact, Math.round(m.confidence * 100), effort, m.score.businessValue, urgency);
  return { id: m.id, projectId: m.projectId, title: m.title, type: 'content_refresh', sourceModule: 'command_center', targetType: 'url', target: m.urlOrCluster, url: m.urlOrCluster, score: score.total, scoreBreakdown: score, impact, confidence: score.confidenceScore, effort, urgency, businessValue: m.score.businessValue, reason: 'Señal consolidada desde Command Center.', recommendation: 'Priorizar optimización SEO on-page y enlazado interno.', status: 'new', dataMode: 'mock', createdAt: m.createdAt, updatedAt: m.updatedAt };
});

export default function OpportunitiesPage() {
  const { currentClient, addTask, modules, updateTaskDetails } = useProject();
  const projectId = currentClient?.id || 'default';
  const [period, setPeriod] = useState('28d');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all'|OpportunityStatus>('all');
  const [items, setItems] = useState<SeoOpportunity[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}${projectId}`);
    if (saved) return JSON.parse(saved) as SeoOpportunity[];
    const seed = mapMock();
    localStorage.setItem(`${STORAGE_PREFIX}${projectId}`, JSON.stringify(seed));
    return seed;
  });

  const persist = (next: SeoOpportunity[]) => {
    setItems(next);
    localStorage.setItem(`${STORAGE_PREFIX}${projectId}`, JSON.stringify(next));
  };

  const filtered = useMemo(() => items
    .filter((o) => statusFilter === 'all' ? o.status !== 'dismissed' : o.status === statusFilter)
    .filter((o) => `${o.title} ${o.target} ${typeLabel[o.type]}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b)=>b.score-a.score), [items, search, statusFilter]);

  const summary = useMemo(() => ({
    total: items.length,
    avg: Math.round(items.reduce((acc, x) => acc + x.score, 0) / Math.max(1, items.length)),
    quickWins: items.filter((x) => x.score >= 70 && x.effort === 'low' && x.status !== 'dismissed').length,
    critical: items.filter((x) => x.score >= 80 && (x.urgency === 'high' || x.impact === 'high')).length,
    sentToTask: items.filter((x) => x.status === 'sent_to_task').length,
    sentToRoadmap: items.filter((x) => x.status === 'sent_to_roadmap').length,
    pendingReview: items.filter((x) => x.status === 'new').length,
    dismissed: items.filter((x) => x.status === 'dismissed').length,
  }), [items]);

  const updateStatus = (id: string, status: OpportunityStatus) => persist(items.map((o)=>o.id===id?{...o,status,updatedAt:new Date().toISOString()}:o));

  const handleCreateTask = (o: SeoOpportunity) => {
    const moduleId = modules[0]?.id ?? 1;
    addTask(moduleId, `[Opportunity] ${o.title}`, o.recommendation, o.impact === 'high' ? 'High' : o.impact === 'medium' ? 'Medium' : 'Low', 'SEO', { status: 'todo' });
    const task = modules[0]?.tasks.at(-1);
    if (task) updateTaskDetails(moduleId, task.id, { insightSourceMeta: { insightId: o.id, sourceType: 'opportunity', sourceLabel: o.sourceModule, metricsSnapshot: { score: o.score, target: o.target }, timestamp: Date.now() } });
    updateStatus(o.id, 'sent_to_task');
  };

  return <div className="space-y-4 p-4">
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div><h1 className="section-title">Opportunities</h1><p className="text-sm text-muted">Oportunidades SEO priorizadas por impacto, confianza, esfuerzo, valor de negocio y urgencia.</p></div>
      <div className="flex gap-2">
        <select className="select" value={period} onChange={(e)=>setPeriod(e.target.value)}><option value="7d">7 días</option><option value="28d">28 días</option><option value="90d">90 días</option></select>
        <button className="btn btn-secondary" onClick={()=>persist(mapMock())}>Recalcular oportunidades</button>
      </div>
    </div>
    <div className="text-xs text-muted">Proyecto: <b>{currentClient?.name || 'Sin proyecto'}</b> · Modo datos: {items.some(x=>x.dataMode==='mock')?'fallback local/mock':'real'} · Periodo: {period}</div>
    <div className="grid md:grid-cols-4 gap-2 text-sm">{Object.entries(summary).map(([k,v])=><div key={k} className="card p-3"><div className="text-muted">{k}</div><div className="text-xl font-semibold">{v}</div></div>)}</div>
    <div className="card p-3 flex gap-2 flex-wrap">
      <input className="input" placeholder="Buscar..." value={search} onChange={(e)=>setSearch(e.target.value)} />
      <select className="select" value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value as any)}><option value="all">Activas</option><option value="new">Nuevas</option><option value="reviewed">Revisadas</option><option value="sent_to_task">Enviadas a tarea</option><option value="sent_to_roadmap">Enviadas a roadmap</option><option value="dismissed">Descartadas</option></select>
    </div>
    <div className="card overflow-auto">
      <table className="w-full text-sm">
        <thead><tr><th className="p-2 text-left">Oportunidad</th><th>Tipo</th><th>Target</th><th>Score</th><th>Impacto</th><th>Esfuerzo</th><th>Urgencia</th><th>Fuente</th><th>Estado</th><th>Acciones</th></tr></thead>
        <tbody>{filtered.map((o)=><tr key={o.id} className="border-t"><td className="p-2"><div className="font-medium">{o.title}</div><div className="text-xs text-muted">{o.reason}</div></td><td>{typeLabel[o.type]}</td><td>{o.target}</td><td>{o.score}</td><td>{o.impact}</td><td>{o.effort}</td><td>{o.urgency}</td><td>{o.sourceModule}</td><td>{o.status}</td><td><div className="flex gap-1 flex-wrap"><button className="btn btn-secondary" onClick={()=>handleCreateTask(o)}>Crear tarea</button><button className="btn btn-secondary" onClick={()=>updateStatus(o.id,'reviewed')}>Revisar</button><button className="btn btn-secondary" onClick={()=>updateStatus(o.id,'sent_to_roadmap')}>Roadmap</button><button className="btn btn-secondary" onClick={()=>updateStatus(o.id,o.status==='dismissed'?'reviewed':'dismissed')}>{o.status==='dismissed'?'Restaurar':'Descartar'}</button></div></td></tr>)}</tbody>
      </table>
    </div>
  </div>;
}

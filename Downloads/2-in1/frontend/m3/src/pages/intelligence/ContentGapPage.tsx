import { useMemo, useState } from 'react';
import { EmptyState, ScoreBadge } from '@/components/intelligence/IntelligenceUI';
import { mockOpportunities } from '@/data/intelligenceMocks';
import { ContentGap, Opportunity } from '@/types/intelligence';
import { loadContentGapState, persistContentGapState, persistOpportunity } from '@/services/intelligencePersistence';

type Competitor = { id: string; name: string; domain: string; priority: 'low'|'medium'|'high'; isPrimary: boolean };
type ImportedKeyword = { id: string; keyword: string; competitor: string; competitorUrl: string; competitorPosition: number; volume: number; difficulty: number; intent: string; cluster: string; source: string };

type GapStatus = 'new'|'reviewed'|'dismissed'|'opportunity_created'|'sent_to_task'|'sent_to_roadmap'|'brief_generated';

const projectId = 'p1';
const initial = loadContentGapState(projectId);

const parseCsv = (value: string): ImportedKeyword[] => value.split('\n').slice(1).map((line) => line.trim()).filter(Boolean).map((line) => {
  const [keyword, competitor, competitorUrl, competitorPosition, volume, difficulty, intent, cluster] = line.split(',');
  return { id: crypto.randomUUID(), keyword, competitor, competitorUrl, competitorPosition: Number(competitorPosition || 0), volume: Number(volume || 0), difficulty: Number(difficulty || 0), intent: intent || 'informational', cluster: cluster || 'general', source: 'csv_import' };
});

const scoreGap = (row: ImportedKeyword, ownPosition?: number) => {
  const searchDemand = row.volume > 3000 ? 90 : row.volume > 800 ? 60 : 30;
  const competitorAdvantage = !ownPosition && row.competitorPosition <= 3 ? 95 : !ownPosition ? 85 : ownPosition - row.competitorPosition > 10 ? 75 : 60;
  const businessValue = ['transactional', 'commercial'].includes(row.intent) ? 90 : row.intent === 'informational' ? 60 : 50;
  const ease = row.difficulty <= 30 ? 85 : row.difficulty <= 60 ? 70 : 45;
  const confidence = 70;
  const urgency = row.intent === 'transactional' ? 85 : 55;
  const total = Math.round(searchDemand * 0.25 + competitorAdvantage * 0.2 + businessValue * 0.2 + ease * 0.15 + confidence * 0.1 + urgency * 0.1);
  return { searchDemand, competitorAdvantage, businessValue, ease, confidence, urgency, total };
};

export default function ContentGapPage(){
  const [competitors, setCompetitors] = useState<Competitor[]>((initial.competitors as Competitor[]) || []);
  const [imports, setImports] = useState<ImportedKeyword[]>((initial.imports as ImportedKeyword[]) || []);
  const [gaps, setGaps] = useState<Array<ContentGap & { scoreTotal: number; status: GapStatus }>>((initial.gaps as Array<ContentGap & { scoreTotal: number; status: GapStatus }>) || []);
  const [csv, setCsv] = useState('keyword,competitor,competitorUrl,competitorPosition,volume,difficulty,intent,cluster');
  const [domain, setDomain] = useState('');

  const saveAll = (next: { competitors?: Competitor[]; imports?: ImportedKeyword[]; gaps?: Array<ContentGap & { scoreTotal: number; status: GapStatus }> }) => {
    const state = { competitors: next.competitors ?? competitors, imports: next.imports ?? imports, gaps: next.gaps ?? gaps };
    persistContentGapState(projectId, state);
  };

  const analyze = () => {
    const detected = imports.map((row) => {
      const score = scoreGap(row);
      return {
        id: crypto.randomUUID(), projectId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), status: 'new' as GapStatus,
        source: row.source, confidence: score.confidence / 100, priority: score.total >= 80 ? 'high' : 'medium', keyword: row.keyword,
        intent: row.intent, volume: row.volume, difficulty: row.difficulty, competitor: row.competitor, competitorUrl: row.competitorUrl,
        competitorPosition: row.competitorPosition, cluster: row.cluster, recommendation: row.competitorUrl ? `Crear/optimizar contenido para ${row.keyword} y mejorar cobertura del cluster ${row.cluster}.` : 'Revisar cobertura de intención.',
        type: row.competitorPosition <= 10 ? 'missing_keyword' : 'position_gap', title: `Gap: ${row.keyword}`, scoreTotal: score.total,
      } as ContentGap & { scoreTotal: number; status: GapStatus };
    });
    setGaps(detected);
    saveAll({ gaps: detected });
  };

  const summary = useMemo(() => ({ total: gaps.length, high: gaps.filter((g) => g.scoreTotal >= 80).length, briefs: gaps.filter((g) => g.status === 'brief_generated').length, sentRoadmap: gaps.filter((g) => g.status === 'sent_to_roadmap').length }), [gaps]);

  const updateGapStatus = (id: string, status: GapStatus) => {
    const next = gaps.map((gap) => gap.id === id ? { ...gap, status, updatedAt: new Date().toISOString() } : gap);
    setGaps(next);
    saveAll({ gaps: next });
  };

  const createOpportunity = (gap: ContentGap & { scoreTotal: number }) => {
    const opp: Opportunity = {
      id: crypto.randomUUID(), projectId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), status: 'new', source: 'content_gap', confidence: gap.confidence,
      priority: gap.priority, title: `Content Gap: ${gap.keyword}`, type: 'keyword_gap', urlOrCluster: gap.cluster || gap.keyword, effort: gap.difficulty > 60 ? 4 : 2,
      score: { impact: Math.min(5, Math.ceil(gap.scoreTotal / 20)), confidence: Math.min(5, Math.ceil(gap.confidence * 5)), ease: gap.difficulty < 40 ? 4 : 2, businessValue: ['commercial','transactional'].includes(gap.intent) ? 5 : 3, urgency: gap.scoreTotal > 80 ? 5 : 3, total: gap.scoreTotal },
      hypothesis: `Si cerramos el gap de ${gap.keyword}, aumentará la cobertura de ${gap.cluster}.`,
    };
    persistOpportunity(opp);
    updateGapStatus(gap.id, 'opportunity_created');
  };

  return <div className='space-y-4 p-4'>
    <div className='flex flex-wrap items-center gap-2'><h1 className='section-title'>Content Gap</h1><span className='badge'>Data mode: partial</span><button className='btn btn-primary' onClick={analyze}>Analizar gaps</button></div>
    <p className='text-sm text-muted'>Detecta oportunidades de contenido comparando tu proyecto contra competidores, keywords, clusters y señales de GSC.</p>

    <div className='card p-4 space-y-2'>
      <h2 className='font-semibold'>Competidores</h2>
      <div className='flex gap-2'><input className='input' value={domain} onChange={(e) => setDomain(e.target.value)} placeholder='dominio competidor' /><button className='btn btn-secondary' onClick={() => { if (!domain) return; const next = [...competitors, { id: crypto.randomUUID(), name: domain, domain, priority: 'medium', isPrimary: competitors.length === 0 }]; setCompetitors(next); saveAll({ competitors: next }); setDomain(''); }}>Añadir competidor</button></div>
      <ul className='text-sm'>{competitors.map((c) => <li key={c.id} className='flex justify-between border-b py-1'>{c.domain}<button className='btn btn-ghost' onClick={() => { const next = competitors.filter((item) => item.id !== c.id); setCompetitors(next); saveAll({ competitors: next }); }}>Eliminar</button></li>)}</ul>
    </div>

    <div className='card p-4 space-y-2'>
      <h2 className='font-semibold'>Importar keywords/URLs competidoras (CSV)</h2>
      <textarea className='input min-h-32 w-full' value={csv} onChange={(e) => setCsv(e.target.value)} />
      <button className='btn btn-secondary' onClick={() => { const parsed = parseCsv(csv); const next = [...imports, ...parsed]; setImports(next); saveAll({ imports: next }); }}>Importar</button>
    </div>

    <div className='grid md:grid-cols-4 gap-2'>
      <div className='card p-3'><p>Total gaps</p><p className='text-xl'>{summary.total}</p></div><div className='card p-3'><p>Alta prioridad</p><p className='text-xl'>{summary.high}</p></div><div className='card p-3'><p>Briefs</p><p className='text-xl'>{summary.briefs}</p></div><div className='card p-3'><p>Roadmap</p><p className='text-xl'>{summary.sentRoadmap}</p></div>
    </div>

    {gaps.length === 0 ? <EmptyState title='No hay gaps detectados todavía. Añade competidores, importa keywords o conecta fuentes de datos para analizar oportunidades.' /> : (
      <div className='card p-4 overflow-auto'>
        <table className='w-full text-sm'>
          <thead><tr><th>Gap</th><th>Keyword/Cluster</th><th>Competidor</th><th>Posición</th><th>Volumen</th><th>Score</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>{gaps.filter((g) => g.status !== 'dismissed').map((gap) => <tr className='border-t' key={gap.id}><td>{gap.type}</td><td>{gap.keyword} / {gap.cluster}</td><td>{gap.competitor}</td><td>{gap.competitorPosition}</td><td>{gap.volume}</td><td><ScoreBadge score={gap.scoreTotal} /></td><td>{gap.status}</td><td className='space-x-1'><button className='btn btn-ghost' onClick={() => createOpportunity(gap)}>Crear oportunidad</button><button className='btn btn-ghost' onClick={() => updateGapStatus(gap.id, 'brief_generated')}>Generar brief</button><button className='btn btn-ghost' onClick={() => updateGapStatus(gap.id, 'sent_to_task')}>Crear tarea</button><button className='btn btn-ghost' onClick={() => updateGapStatus(gap.id, 'sent_to_roadmap')}>Roadmap</button><button className='btn btn-ghost' onClick={() => updateGapStatus(gap.id, 'dismissed')}>Descartar</button></td></tr>)}</tbody>
        </table>
      </div>
    )}
  </div>
}

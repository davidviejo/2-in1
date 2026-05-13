import { useMemo } from 'react';
import { OpportunityCard, mockOpportunities } from '@/components/intelligence/IntelligenceUI';
import { useProject } from '@/context/ProjectContext';

export default function OpportunitiesPage(){
  const { currentClientId } = useProject();
  const persisted = useMemo(() => {
    try { return JSON.parse(localStorage.getItem(`agenciaseo:opportunities:${currentClientId}`) || '[]'); } catch { return []; }
  }, [currentClientId]);
  const all = useMemo(() => [...persisted, ...mockOpportunities].sort((a,b)=>b.score.total-a.score.total), [persisted]);
  return <div className="space-y-4 p-4"><h1 className="section-title">Opportunities</h1><p className="text-sm text-muted">Score = Impacto × Confianza × Facilidad × Valor negocio × Urgencia</p><div className="grid md:grid-cols-2 gap-3">{all.map((o:any)=><OpportunityCard key={o.id} opportunity={o} />)}</div></div>
}

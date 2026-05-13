import { OpportunityCard } from '@/components/intelligence/IntelligenceUI';
import { mockOpportunities } from '@/data/intelligenceMocks';
import { loadPersistedOpportunities } from '@/services/intelligencePersistence';

export default function OpportunitiesPage(){
  const persisted = typeof window === 'undefined' ? [] : loadPersistedOpportunities();
  const opportunities = [...persisted, ...mockOpportunities.filter((mock) => !persisted.some((item) => item.id === mock.id))];
  return <div className="space-y-4 p-4"><h1 className="section-title">Opportunities</h1><p className="text-sm text-muted">Score = Impacto × Confianza × Facilidad × Valor negocio × Urgencia</p><div className="grid md:grid-cols-2 gap-3">{opportunities.sort((a,b)=>b.score.total-a.score.total).map(o=><OpportunityCard key={o.id} opportunity={o} />)}</div></div>
}

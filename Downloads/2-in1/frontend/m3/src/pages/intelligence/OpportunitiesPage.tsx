import { OpportunityCard } from '@/components/intelligence/IntelligenceUI';
import { mockOpportunities } from '@/data/intelligenceMocks';
export default function OpportunitiesPage(){return <div className="space-y-4 p-4"><h1 className="section-title">Opportunities</h1><p className="text-sm text-muted">Score = Impacto × Confianza × Facilidad × Valor negocio × Urgencia</p><div className="grid md:grid-cols-2 gap-3">{mockOpportunities.sort((a,b)=>b.score.total-a.score.total).map(o=><OpportunityCard key={o.id} opportunity={o} />)}</div></div>}

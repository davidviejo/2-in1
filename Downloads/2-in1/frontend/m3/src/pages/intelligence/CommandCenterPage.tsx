import { OpportunityCard, PriorityMatrix, SeoSignalCard } from '@/components/intelligence/IntelligenceUI';
import { mockOpportunities, mockSignals } from '@/data/intelligenceMocks';
export default function CommandCenterPage() {
  return <div className="space-y-4 p-4"><h1 className="section-title">Command Center</h1><PriorityMatrix />{mockSignals.map((s)=><SeoSignalCard key={s.id} title={s.title} detail={`${s.urlOrCluster} · ${s.delta}%`} />)}<div className="grid md:grid-cols-2 gap-3">{mockOpportunities.map((o)=><OpportunityCard key={o.id} opportunity={o} />)}</div></div>;
}

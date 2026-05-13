import { ImpactBeforeAfter } from '@/components/intelligence/IntelligenceUI';
import { mockImpactLedger } from '@/data/intelligenceMocks';
export default function ImpactLedgerPage(){return <div className='p-4 space-y-3'><h1 className='section-title'>Impact Ledger</h1>{mockImpactLedger.map(e=><div key={e.id} className='card p-4'><p className='font-semibold'>{e.action}</p><p className='text-sm text-muted'>{e.hypothesis}</p><ImpactBeforeAfter value={e.beforeAfter} /></div>)}</div>}

import { UrlIssueTable } from '@/components/intelligence/IntelligenceUI';
import { mockIndexation } from '@/data/intelligenceMocks';
export default function IndexationMonitorPage(){return <div className="space-y-4 p-4"><h1 className="section-title">Indexation Monitor</h1><UrlIssueTable rows={mockIndexation.map((r)=>({url:r.url,status:r.indexable?'Indexable':'No indexable',action:r.suggestedAction}))} /></div>}

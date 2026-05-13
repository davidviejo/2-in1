import React, { useMemo, useState } from 'react';
import { SeoPage } from '@/types/seoChecklist';
import { Button } from '@/components/ui/Button';
import { openaiApi } from '@/services/openaiApi';

type Props = { pages: SeoPage[]; onBulkUpdate: (updates: Array<Partial<SeoPage> & { id: string }>) => void };

type KwCandidate = { id: string; keyword: string; url: string; clicks: number; impressions: number };

const normalizeKeywordRows = (page: SeoPage): KwCandidate[] => {
  const rows = page.checklist?.OPORTUNIDADES?.autoData?.gscQueries;
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row: any, index: number) => ({
      id: `${page.id}-${index}`,
      keyword: String(row.query || row.keyword || '').trim(),
      url: page.url,
      clicks: Number(row.clicks || 0),
      impressions: Number(row.impressions || 0),
    }))
    .filter((row: KwCandidate) => row.keyword);
};

export const KwClusterizationPanel: React.FC<Props> = ({ pages, onBulkUpdate }) => {
  const [selectedPageIds, setSelectedPageIds] = useState<Set<string>>(new Set());
  const [selectedKeywordIds, setSelectedKeywordIds] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState('Selecciona URLs y keywords para clusterizar automáticamente.');
  const [loading, setLoading] = useState(false);

  const selectedPages = useMemo(() => pages.filter((p) => selectedPageIds.has(p.id)), [pages, selectedPageIds]);
  const kwCandidates = useMemo(() => selectedPages.flatMap(normalizeKeywordRows), [selectedPages]);

  const groupedResult = useMemo(() => {
    const map = new Map<string, KwCandidate[]>();
    kwCandidates.filter((kw) => selectedKeywordIds.has(kw.id)).forEach((kw) => {
      const key = kw.keyword.toLowerCase();
      const list = map.get(key) || [];
      list.push(kw);
      map.set(key, list);
    });
    return map;
  }, [kwCandidates, selectedKeywordIds]);

  const runClusterization = async () => {
    const selected = kwCandidates.filter((kw) => selectedKeywordIds.has(kw.id));
    if (selected.length === 0) {
      setStatus('Selecciona al menos 1 keyword para clusterizar.');
      return;
    }
    setLoading(true);
    try {
      const payload = selected.map((kw) => ({ id: kw.id, url: kw.url, title: kw.keyword, h1: kw.keyword }));
      const response = await openaiApi.clusterize(payload);
      const clusterByKeyword = new Map<string, string>();
      (response.clusters || []).forEach((item) => {
        clusterByKeyword.set(item.id, item.cluster || 'Sin cluster');
      });

      const updates = selectedPages.map((page) => {
        const selectedForPage = selected.filter((kw) => kw.url === page.url);
        const cluster = selectedForPage.map((kw) => clusterByKeyword.get(kw.id)).find(Boolean) || page.cluster || '';
        return { id: page.id, cluster };
      });
      onBulkUpdate(updates);
      setStatus(`Clusterización KWs completada. ${selected.length} keywords procesadas.`);
    } catch (e) {
      console.error(e);
      setStatus('Error al clusterizar keywords.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">{status}</p>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded border p-3">
          <h3 className="font-semibold mb-2">URLs disponibles</h3>
          <div className="max-h-72 overflow-auto space-y-1">
            {pages.map((page) => (
              <label key={page.id} className="flex gap-2 text-xs">
                <input type="checkbox" checked={selectedPageIds.has(page.id)} onChange={(e) => {
                  const next = new Set(selectedPageIds);
                  e.target.checked ? next.add(page.id) : next.delete(page.id);
                  setSelectedPageIds(next);
                }} />
                <span>{page.url}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="rounded border p-3">
          <h3 className="font-semibold mb-2">Keywords GSC</h3>
          <div className="max-h-72 overflow-auto space-y-1">
            {kwCandidates.map((kw) => (
              <label key={kw.id} className="flex gap-2 text-xs">
                <input type="checkbox" checked={selectedKeywordIds.has(kw.id)} onChange={(e) => {
                  const next = new Set(selectedKeywordIds);
                  e.target.checked ? next.add(kw.id) : next.delete(kw.id);
                  setSelectedKeywordIds(next);
                }} />
                <span>{kw.keyword} · {kw.clicks} clics</span>
              </label>
            ))}
          </div>
        </div>
      </div>
      <Button onClick={runClusterization} disabled={loading}>{loading ? 'Procesando...' : 'Ejecutar clusterización KWs'}</Button>
      <div className="rounded border p-3">
        <h3 className="font-semibold mb-2">Desglose rápido (keywords seleccionadas)</h3>
        {[...groupedResult.entries()].slice(0, 100).map(([keyword, items]) => (
          <div key={keyword} className="text-xs text-slate-700">{keyword} · {items.length} URL(s)</div>
        ))}
      </div>
    </div>
  );
};

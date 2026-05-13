import React, { useMemo, useState } from 'react';
import { SeoPage } from '@/types/seoChecklist';
import { Button } from '@/components/ui/Button';

type Props = { pages: SeoPage[]; onBulkUpdate: (updates: Array<Partial<SeoPage> & { id: string }>) => void };

export const WebBreakdownPanel: React.FC<Props> = ({ pages, onBulkUpdate }) => {
  const [selectedCluster, setSelectedCluster] = useState('all');
  const [regex, setRegex] = useState('');
  const clusters = useMemo(() => {
    const map = new Map<string, { cluster: string; urls: number; clicks: number; depth: number; withoutCluster: number }>();
    pages.forEach((page) => {
      const pathTokens = (() => {
        try {
          return new URL(page.url).pathname.split('/').filter(Boolean);
        } catch {
          return [];
        }
      })();
      const level1 = pathTokens[0] || '/';
      const level2 = pathTokens[1] || '/';
      const baseCluster = `${level1} / ${level2}`;
      const cluster = (page.cluster || '').trim() || baseCluster;
      const curr = map.get(cluster) || { cluster, urls: 0, clicks: 0, depth: pathTokens.length, withoutCluster: 0, fullUrls: [] as string[] };
      curr.urls += 1;
      curr.clicks += Number(page.gscMetrics?.clicks || 0);
      curr.depth = Math.max(curr.depth, pathTokens.length);
      if (!(page.cluster || '').trim() && pathTokens.length <= 1) curr.withoutCluster += 1;
      curr.fullUrls.push(page.url);
      map.set(cluster, curr);
    });
    return [...map.values()].sort((a, b) => b.clicks - a.clicks);
  }, [pages]);

  const filteredPages = useMemo(() => {
    if (selectedCluster === 'all') return pages;
    return pages.filter((page) => {
      const pathTokens = (() => {
        try {
          return new URL(page.url).pathname.split('/').filter(Boolean);
        } catch {
          return [];
        }
      })();
      const derivedCluster = `${pathTokens[0] || '/'} / ${pathTokens[1] || '/'}`;
      return ((page.cluster || '').trim() || derivedCluster) === selectedCluster;
    });
  }, [pages, selectedCluster]);

  const applyRegexCluster = () => {
    if (!regex.trim()) return;
    let expr: RegExp;
    try {
      expr = new RegExp(regex, 'i');
    } catch {
      return;
    }
    const updates = filteredPages
      .filter((page) => expr.test(page.url))
      .map((page) => ({ id: page.id, cluster: `Regex: ${regex}` }));
    onBulkUpdate(updates);
  };

  const exportCurrent = () => {
    const headers = ['url', 'cluster', 'clicks', 'impressions'];
    const rows = filteredPages.map((page) => [page.url, page.cluster || '', page.gscMetrics?.clicks || 0, page.gscMetrics?.impressions || 0]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `desglose-web-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-end">
        <div>
          <label className="text-xs">Cluster superior</label>
          <select className="form-control" value={selectedCluster} onChange={(e) => setSelectedCluster(e.target.value)}>
            <option value="all">Todos</option>
            {clusters.map((cluster) => <option key={cluster.cluster} value={cluster.cluster}>{cluster.cluster} ({cluster.clicks} clics)</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="text-xs">Cluster manual por regex</label>
          <input className="form-control" value={regex} onChange={(e) => setRegex(e.target.value)} placeholder="/blog|articulos|servicios" />
        </div>
        <Button onClick={applyRegexCluster}>Aplicar regex</Button>
        <Button variant="secondary" onClick={exportCurrent}>Exportar</Button>
      </div>
      <div className="overflow-auto rounded border">
        <table className="w-full text-xs">
          <thead><tr><th className="px-2 py-2 text-left">Cluster</th><th className="px-2 py-2 text-left">URLs</th><th className="px-2 py-2 text-left">Clics</th><th className="px-2 py-2 text-left">Niveles</th><th className="px-2 py-2 text-left">Sin cluster manual</th><th className="px-2 py-2 text-left">URLs completas asignadas</th></tr></thead>
          <tbody>
            {clusters.map((c) => <tr key={c.cluster}><td className="px-2 py-1">{c.cluster}</td><td className="px-2 py-1">{c.urls}</td><td className="px-2 py-1">{c.clicks}</td><td className="px-2 py-1">{c.depth}</td><td className="px-2 py-1">{c.withoutCluster}</td><td className="px-2 py-1 max-w-xl break-all">{c.fullUrls.join(' | ')}</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
};

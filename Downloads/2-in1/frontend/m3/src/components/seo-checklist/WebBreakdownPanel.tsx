import React, { useMemo, useState } from 'react';
import { SeoPage } from '@/types/seoChecklist';
import { Button } from '@/components/ui/Button';

type Props = { pages: SeoPage[]; onBulkUpdate: (updates: Array<Partial<SeoPage> & { id: string }>) => void };

export const WebBreakdownPanel: React.FC<Props> = ({ pages, onBulkUpdate }) => {
  const [selectedCluster, setSelectedCluster] = useState('all');
  const [regex, setRegex] = useState('');
  const [sortBy, setSortBy] = useState<'urls' | 'clicks' | 'depth'>('urls');

  const getTopLevelCluster = (page: SeoPage) => {
    const manualCluster = (page.cluster || '').trim();
    if (manualCluster) {
      return manualCluster
        .split('/')
        .map((part) => part.trim())
        .filter(Boolean)[0] || manualCluster;
    }

    try {
      const pathTokens = new URL(page.url).pathname.split('/').filter(Boolean);
      return pathTokens[0] || 'home';
    } catch {
      return 'home';
    }
  };

  const clusters = useMemo(() => {
    type ClusterRow = {
      key: string;
      levelPath: string[];
      urls: number;
      clicks: number;
      depth: number;
      withoutCluster: number;
      fullUrls: string[];
    };

    const map = new Map<string, ClusterRow>();
    pages.forEach((page) => {
      const pathTokens = (() => {
        try {
          return new URL(page.url).pathname.split('/').filter(Boolean);
        } catch {
          return [];
        }
      })();

      const levelOne = getTopLevelCluster(page);
      const hierarchyLevels = [levelOne, ...pathTokens.slice(1)];

      hierarchyLevels.forEach((_, levelIndex) => {
        const levelPath = hierarchyLevels.slice(0, levelIndex + 1);
        const key = levelPath.join(' > ');
        const curr = map.get(key) || {
          key,
          levelPath,
          urls: 0,
          clicks: 0,
          depth: levelPath.length,
          withoutCluster: 0,
          fullUrls: [] as string[],
        };

        curr.urls += 1;
        curr.clicks += Number(page.gscMetrics?.clicks || 0);
        curr.depth = Math.max(curr.depth, levelPath.length);
        if (!(page.cluster || '').trim() && levelPath.length === 1 && pathTokens.length <= 1) curr.withoutCluster += 1;
        curr.fullUrls.push(page.url);
        map.set(key, curr);
      });
    });

    return [...map.values()].sort((a, b) => {
      if (sortBy === 'clicks') return b.clicks - a.clicks;
      if (sortBy === 'depth') return b.depth - a.depth || b.urls - a.urls;
      return b.urls - a.urls || b.clicks - a.clicks;
    });
  }, [pages, sortBy]);

  const maxLevel = useMemo(() => clusters.reduce((acc, row) => Math.max(acc, row.levelPath.length), 1), [clusters]);

  const filteredPages = useMemo(() => {
    if (selectedCluster === 'all') return pages;
    return pages.filter((page) => getTopLevelCluster(page) === selectedCluster);
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
    const headers = [
      ...Array.from({ length: maxLevel }).map((_, idx) => `nivel_${idx + 1}`),
      'ruta_cluster',
      'urls_en_cluster',
      'clicks_cluster',
      'profundidad_cluster',
      'sin_cluster_manual',
      'urls_completas_asignadas',
    ];
    const rows = clusters
      .filter((cluster) => selectedCluster === 'all' || cluster.levelPath[0] === selectedCluster)
      .map((cluster) => [
        ...Array.from({ length: maxLevel }).map((_, idx) => cluster.levelPath[idx] || ''),
        cluster.key,
        cluster.urls,
        cluster.clicks,
        cluster.depth,
        cluster.withoutCluster,
        cluster.fullUrls.join(' | '),
      ]);
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
            {clusters
              .filter((cluster) => cluster.levelPath.length === 1)
              .map((cluster) => <option key={cluster.key} value={cluster.levelPath[0]}>{cluster.levelPath[0]} ({cluster.clicks} clics)</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs">Ordenar tabla</label>
          <select className="form-control" value={sortBy} onChange={(e) => setSortBy(e.target.value as 'urls' | 'clicks' | 'depth')}>
            <option value="urls">Por cantidad de URLs</option>
            <option value="clicks">Por clics</option>
            <option value="depth">Por profundidad</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="text-xs">Cluster manual por regex</label>
          <input className="form-control" value={regex} onChange={(e) => setRegex(e.target.value)} placeholder="/blog|articulos|servicios" />
        </div>
        <Button onClick={applyRegexCluster}>Aplicar regex</Button>
        <Button variant="secondary" onClick={exportCurrent}>Exportar</Button>
      </div>
      <div className="overflow-x-auto overflow-y-auto rounded border max-h-[68vh]">
        <table className="min-w-max text-xs leading-tight">
          <thead><tr>{Array.from({ length: maxLevel }).map((_, idx) => <th key={`level-${idx + 1}`} className="px-2 py-2 text-left">Nivel {idx + 1}</th>)}<th className="px-2 py-2 text-left">URLs</th><th className="px-2 py-2 text-left">Clics</th><th className="px-2 py-2 text-left">Niveles</th><th className="px-2 py-2 text-left">Sin cluster manual</th><th className="px-2 py-2 text-left">URLs completas asignadas</th></tr></thead>
          <tbody>
            {clusters
              .filter((c) => selectedCluster === 'all' || c.levelPath[0] === selectedCluster)
              .map((c) => <tr key={c.key}>{Array.from({ length: maxLevel }).map((_, idx) => <td key={`${c.key}-${idx}`} className="px-2 py-0.5 align-top">{c.levelPath[idx] || ''}</td>)}<td className="px-2 py-0.5 align-top">{c.urls}</td><td className="px-2 py-0.5 align-top">{c.clicks}</td><td className="px-2 py-0.5 align-top">{c.depth}</td><td className="px-2 py-0.5 align-top">{c.withoutCluster}</td><td className="px-2 py-0.5 align-top min-w-[24rem] max-w-[34rem]"><div className="max-h-24 overflow-y-auto whitespace-nowrap">{c.fullUrls.join(' | ')}</div></td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
};

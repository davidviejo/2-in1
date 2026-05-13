import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { SeoPage } from '@/types/seoChecklist';
import { Button } from '@/components/ui/Button';

type Props = { pages: SeoPage[]; onBulkUpdate: (updates: Array<Partial<SeoPage> & { id: string }>) => void };

type KwCandidate = { id: string; keyword: string; url: string; clicks: number; impressions: number; source: 'gsc' | 'file' };

type ParsedFileKeyword = { keyword: string; url?: string };

const MAX_GSC_EXTRA_KWS_PER_URL = 10;
const ACCEPTED_FILE_COLUMNS = ['id', 'parent', 'kw padre', 'kw_padre', 'keyword', 'kw', 'child', 'children', 'url', 'tipo'];

const normalizeHeader = (value: unknown) => String(value || '').trim().toLowerCase();

const getTopGscKeywords = (page: SeoPage): KwCandidate[] => {
  const rows = page.checklist?.OPORTUNIDADES?.autoData?.gscQueries;
  if (!Array.isArray(rows)) return [];

  const topRows = rows
    .map((row: any) => ({
      keyword: String(row.query || row.keyword || '').trim(),
      clicks: Number(row.clicks || 0),
      impressions: Number(row.impressions || 0),
      position: Number(row.position || Number.MAX_SAFE_INTEGER),
    }))
    .filter((row) => row.keyword)
    .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions || a.position - b.position);

  const principal = String(page.mainKeyword || '').trim();
  const secundaria = String(page.secondaryKeyword || '').trim();
  const seen = new Set<string>();
  const ordered: Array<{ keyword: string; clicks: number; impressions: number }> = [];

  [principal, secundaria].filter(Boolean).forEach((kw) => {
    const key = kw.toLowerCase();
    if (seen.has(key)) return;
    const gscRow = topRows.find((row) => row.keyword.toLowerCase() === key);
    ordered.push({ keyword: kw, clicks: gscRow?.clicks || 0, impressions: gscRow?.impressions || 0 });
    seen.add(key);
  });

  topRows.forEach((row) => {
    const key = row.keyword.toLowerCase();
    if (seen.has(key)) return;
    if (ordered.length >= 2 + MAX_GSC_EXTRA_KWS_PER_URL) return;
    ordered.push({ keyword: row.keyword, clicks: row.clicks, impressions: row.impressions });
    seen.add(key);
  });

  return ordered.map((row, index) => ({
    id: `${page.id}-gsc-${index}`,
    keyword: row.keyword,
    url: page.url,
    clicks: row.clicks,
    impressions: row.impressions,
    source: 'gsc',
  }));
};


const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface BackendClusterResult {
  id?: string;
  parent?: string;
  children?: string[];
}

const parseKeywordFile = async (file: File): Promise<ParsedFileKeyword[]> => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) return [];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[firstSheet], { defval: '' });

  const extracted: ParsedFileKeyword[] = [];

  rows.forEach((row) => {
    const normalizedMap = new Map<string, unknown>();
    Object.entries(row).forEach(([key, value]) => normalizedMap.set(normalizeHeader(key), value));

    const url = String(normalizedMap.get('url') || '').trim();
    const parent = String(
      normalizedMap.get('kw padre') || normalizedMap.get('kw_padre') || normalizedMap.get('parent') || '',
    ).trim();
    const mainKeyword = String(normalizedMap.get('keyword') || normalizedMap.get('kw') || '').trim();

    const childrenRaw = String(normalizedMap.get('children') || normalizedMap.get('child') || '').trim();
    const children = childrenRaw
      .split(/[|;,]/)
      .map((value) => value.trim())
      .filter(Boolean);

    [parent, mainKeyword, ...children].forEach((keyword) => {
      if (!keyword) return;
      extracted.push({ keyword, url });
    });
  });

  const deduped = new Map<string, ParsedFileKeyword>();
  extracted.forEach((row) => {
    const key = `${row.keyword.toLowerCase()}|${(row.url || '').toLowerCase()}`;
    if (!deduped.has(key)) deduped.set(key, row);
  });

  return [...deduped.values()];
};

export const KwClusterizationPanel: React.FC<Props> = ({ pages, onBulkUpdate }) => {
  const [selectedPageIds, setSelectedPageIds] = useState<Set<string>>(new Set());
  const [selectedKeywordIds, setSelectedKeywordIds] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState('Selecciona URLs, marca keywords (GSC y/o archivo), pulsa OK y luego ejecuta la clusterización.');
  const [loading, setLoading] = useState(false);
  const [dataforseoLogin, setDataforseoLogin] = useState('');
  const [dataforseoPassword, setDataforseoPassword] = useState('');
  const [dataforseoDetail, setDataforseoDetail] = useState<'regular' | 'advanced'>('advanced');
  const [dataforseoExecutionMode, setDataforseoExecutionMode] = useState<'live' | 'standard' | 'priority'>('live');
  const [useDataforseoForClusterization, setUseDataforseoForClusterization] = useState(true);
  const [strategyWorkbookName, setStrategyWorkbookName] = useState('');
  const [fileKeywords, setFileKeywords] = useState<ParsedFileKeyword[]>([]);
  const [selectionConfirmed, setSelectionConfirmed] = useState(false);

  const selectedPages = useMemo(() => pages.filter((p) => selectedPageIds.has(p.id)), [pages, selectedPageIds]);
  const gscKwCandidates = useMemo(() => selectedPages.flatMap(getTopGscKeywords), [selectedPages]);
  const fileKwCandidates = useMemo(() => {
    return fileKeywords.map((kw, index) => ({
      id: `file-${index}`,
      keyword: kw.keyword,
      url: kw.url || 'Sin URL (archivo)',
      clicks: 0,
      impressions: 0,
      source: 'file' as const,
    }));
  }, [fileKeywords]);
  const kwCandidates = useMemo(() => [...gscKwCandidates, ...fileKwCandidates], [gscKwCandidates, fileKwCandidates]);

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

  const selectedKeywords = useMemo(() => kwCandidates.filter((kw) => selectedKeywordIds.has(kw.id)), [kwCandidates, selectedKeywordIds]);

  const selectionSummary = useMemo(() => {
    const fromGsc = selectedKeywords.filter((kw) => kw.source === 'gsc').length;
    const fromFile = selectedKeywords.filter((kw) => kw.source === 'file').length;
    return {
      total: selectedKeywords.length,
      fromGsc,
      fromFile,
      provider: useDataforseoForClusterization ? 'DataForSEO' : 'Desactivado',
    };
  }, [selectedKeywords, useDataforseoForClusterization]);

  const handleConfirmSelection = () => {
    if (selectedKeywords.length === 0) {
      setStatus('Selecciona al menos 1 keyword antes de confirmar con OK.');
      setSelectionConfirmed(false);
      return;
    }
    setSelectionConfirmed(true);
    setStatus('Selección confirmada. Revisa el resumen y ejecuta la clusterización de KWs.');
  };

  const runClusterization = async () => {
    if (!selectionConfirmed) {
      setStatus('Primero confirma con OK la selección de keywords.');
      return;
    }
    if (selectedKeywords.length === 0) {
      setStatus('Selecciona al menos 1 keyword para clusterizar.');
      return;
    }
    setLoading(true);
    try {
      const keywordClusterMap = new Map<string, string>();

      if (useDataforseoForClusterization) {
        const formData = new FormData();
        formData.append('keywords', selectedKeywords.map((kw) => kw.keyword).join('\n'));
        formData.append('mode', 'dataforseo');
        formData.append('dataforseo_detail', dataforseoDetail);
        formData.append('dataforseo_execution_mode', dataforseoExecutionMode);
        if (dataforseoLogin) formData.append('dataforseo_login', dataforseoLogin);
        if (dataforseoPassword) formData.append('dataforseo_password', dataforseoPassword);

        const startResponse = await fetch('/seo/run', { method: 'POST', body: formData });
        const startPayload = await startResponse.json();
        if (!startResponse.ok || startPayload?.status !== 'ok') {
          throw new Error(startPayload?.message || 'No se pudo iniciar la clusterización backend');
        }

        let statusPayload: { active?: boolean; results?: BackendClusterResult[]; error?: string } = {};
        for (let attempt = 0; attempt < 90; attempt += 1) {
          const statusResponse = await fetch('/seo/status');
          statusPayload = await statusResponse.json();
          if (!statusPayload.active) break;
          await sleep(2000);
        }

        if (statusPayload.error) throw new Error(statusPayload.error);

        (statusPayload.results || []).forEach((cluster) => {
          const clusterName = String(cluster.parent || cluster.id || '').trim();
          if (!clusterName) return;
          const allKeywords = [cluster.parent, ...(cluster.children || [])]
            .map((value) => String(value || '').trim().toLowerCase())
            .filter(Boolean);
          allKeywords.forEach((keyword) => {
            if (!keywordClusterMap.has(keyword)) keywordClusterMap.set(keyword, clusterName);
          });
        });
      } else {
        selectedPages.forEach((page) => {
          const clusters = page.checklist?.OPORTUNIDADES?.autoData?.clusters;
          if (!Array.isArray(clusters)) return;
          clusters.forEach((cluster: any) => {
            const clusterName = String(cluster.kwObjetivo || cluster.clusterId || '').trim();
            if (!clusterName) return;
            const strategyKeywords = [cluster.kwObjetivo, ...(cluster.variations || [])]
              .map((value: any) => String(value || '').trim().toLowerCase())
              .filter(Boolean);
            strategyKeywords.forEach((keyword: string) => {
              if (!keywordClusterMap.has(keyword)) keywordClusterMap.set(keyword, clusterName);
            });
          });
        });
      }

      const updates = selectedPages.map((page) => {
        const selectedForPage = selectedKeywords.filter((kw) => kw.url === page.url);
        const cluster = selectedForPage
          .map((kw) => keywordClusterMap.get(kw.keyword.toLowerCase()))
          .find(Boolean) || page.cluster || '';
        return { id: page.id, cluster };
      });
      onBulkUpdate(updates);
      const matched = selectedKeywords.filter((kw) => keywordClusterMap.has(kw.keyword.toLowerCase())).length;
      setStatus(`Clusterización KWs completada con ${useDataforseoForClusterization ? 'backend' : 'mapeo local'}. ${matched}/${selectedKeywords.length} keywords mapeadas.`);
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
      <div className="rounded border p-3 grid gap-3 md:grid-cols-2">
        <div>
          <label className="text-xs">DataForSEO Login</label>
          <input className="form-control" value={dataforseoLogin} onChange={(e) => setDataforseoLogin(e.target.value.trim())} placeholder="login" />
        </div>
        <div>
          <label className="text-xs">DataForSEO Password</label>
          <input type="password" className="form-control" value={dataforseoPassword} onChange={(e) => setDataforseoPassword(e.target.value)} placeholder="password" />
        </div>
        <div>
          <label className="text-xs">DataForSEO Detail</label>
          <select className="form-control" value={dataforseoDetail} onChange={(e) => setDataforseoDetail(e.target.value as 'regular' | 'advanced')}>
            <option value="advanced">advanced</option>
            <option value="regular">regular</option>
          </select>
        </div>
        <div>
          <label className="text-xs">DataForSEO Execution Mode</label>
          <select className="form-control" value={dataforseoExecutionMode} onChange={(e) => setDataforseoExecutionMode(e.target.value as 'live' | 'standard' | 'priority')}>
            <option value="live">live</option>
            <option value="standard">standard</option>
            <option value="priority">priority</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={useDataforseoForClusterization} onChange={(e) => setUseDataforseoForClusterization(e.target.checked)} />Usar DataForSEO para clusterización KWs</label>
        </div>
        <div className="md:col-span-2">
          <label className="text-xs">Archivo de keywords (formato backend: id + kw padre + children)</label>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            className="form-control"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              setStrategyWorkbookName(file?.name || '');
              if (!file) {
                setFileKeywords([]);
                return;
              }
              const parsed = await parseKeywordFile(file);
              setFileKeywords(parsed);
            }}
          />
          <div className="mt-2 rounded border border-dashed p-2 text-xs text-slate-600">
            <p className="font-semibold">Plantilla backend (2 filas ejemplo)</p>
            <p>Columnas aceptadas: {ACCEPTED_FILE_COLUMNS.join(', ')}</p>
            <pre className="mt-1 overflow-auto text-[11px]">id,kw_padre,children,url,tipo\nCL-001,zapatillas running,comprar zapatillas running|zapatillas running mujer,https://midominio.com/zapatillas,principal\nCL-002,zapatillas trail,mejores zapatillas trail 2026|zapatillas trail impermeables,https://midominio.com/trail,secundaria</pre>
          </div>
        </div>
      </div>
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
                  setSelectionConfirmed(false);
                }} />
                <span>{page.url}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="rounded border p-3">
          <h3 className="font-semibold mb-2">Keywords disponibles (GSC + archivo)</h3>
          <div className="max-h-72 overflow-auto space-y-1">
            {kwCandidates.map((kw) => (
              <label key={kw.id} className="flex gap-2 text-xs">
                <input type="checkbox" checked={selectedKeywordIds.has(kw.id)} onChange={(e) => {
                  const next = new Set(selectedKeywordIds);
                  e.target.checked ? next.add(kw.id) : next.delete(kw.id);
                  setSelectedKeywordIds(next);
                  setSelectionConfirmed(false);
                }} />
                <span>{kw.keyword} · {kw.source === 'gsc' ? `${kw.clicks} clics` : 'archivo'} · {kw.url}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={handleConfirmSelection}>OK</Button>
        <Button onClick={runClusterization} disabled={loading || !selectionConfirmed}>{loading ? 'Procesando...' : 'Iniciar clusterización KWs'}</Button>
      </div>

      <div className="rounded border p-3 space-y-1">
        <h3 className="font-semibold mb-2">Resumen previo a clusterizar</h3>
        <p className="text-xs text-slate-700">API: {selectionSummary.provider}</p>
        <p className="text-xs text-slate-700">Ajustes: detail={dataforseoDetail}, mode={dataforseoExecutionMode}, credenciales={dataforseoLogin && dataforseoPassword ? 'ok' : 'pendiente'}.</p>
        <p className="text-xs text-slate-700">Archivo cargado: {strategyWorkbookName || 'sin archivo'} ({fileKeywords.length} keywords válidas).</p>
        <p className="text-xs text-slate-700">Keywords finales a analizar: {selectionSummary.total} (GSC: {selectionSummary.fromGsc}, archivo: {selectionSummary.fromFile}).</p>
      </div>

      <div className="rounded border p-3">
        <h3 className="font-semibold mb-2">Desglose rápido (keywords seleccionadas)</h3>
        {[...groupedResult.entries()].slice(0, 100).map(([keyword, items]) => (
          <div key={keyword} className="text-xs text-slate-700">{keyword} · {items.length} URL(s)</div>
        ))}
      </div>
    </div>
  );
};

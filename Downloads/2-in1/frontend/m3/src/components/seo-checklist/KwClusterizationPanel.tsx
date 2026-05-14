import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { CHECKLIST_STATUS_LABELS, ChecklistStatus, SeoPage } from '@/types/seoChecklist';
import { Button } from '@/components/ui/Button';
import { listSites, querySearchAnalyticsPaged } from '@/services/googleSearchConsole';
import { resolveEngineUrl } from '@/services/apiUrlHelper';

type Props = { pages: SeoPage[]; onBulkUpdate: (updates: { id: string; changes: Partial<SeoPage> }[]) => void };

type KwCandidate = { id: string; keyword: string; url: string; clicks: number; impressions: number; source: 'gsc' | 'file' };

type ParsedFileKeyword = { keyword: string; url?: string };

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


const sanitizeRawUrl = (value: string) => value.trim().replace(/[|\s]+$/g, '');

const normalizeUrlMatchKey = (value: string) => {
  const cleaned = sanitizeRawUrl(value);
  if (!cleaned) return '';
  const withProtocol = /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
  try {
    const parsed = new URL(withProtocol);
    const host = parsed.host.toLowerCase();
    const pathname = (parsed.pathname || '/').replace(/\/+$/, '') || '/';
    return `${host}${pathname.toLowerCase()}`;
  } catch {
    return cleaned.replace(/\/+$/, '').toLowerCase();
  }
};

const normalizeUrlCandidate = (value: string) => {
  const trimmed = sanitizeRawUrl(value);
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    const pathname = parsed.pathname !== '/' ? parsed.pathname.replace(/\/+$/, '') || '/' : '/';
    return `${parsed.protocol}//${parsed.host}${pathname}`;
  } catch {
    return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
  }
};

const buildUrlVariants = (value: string) => {
  const normalized = normalizeUrlCandidate(value);
  if (!normalized) return [];
  if (normalized.endsWith('/')) return [normalized, normalized.slice(0, -1)].filter(Boolean);
  return [normalized, `${normalized}/`];
};

const resolvePoint12Status = (page: SeoPage): ChecklistStatus => {
  const oportunidades = page.checklist?.OPORTUNIDADES;
  if (!oportunidades) return 'NA';
  if (oportunidades.status_manual && oportunidades.status_manual !== 'NA') return oportunidades.status_manual;
  if (oportunidades.suggested_status) return oportunidades.suggested_status;
  return oportunidades.status_manual || 'NA';
};


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
  const [urlFilter, setUrlFilter] = useState('');
  const [keywordFilter, setKeywordFilter] = useState('');
  const [gscDateRangeDays, setGscDateRangeDays] = useState<number>(56);

  const [gscProperties, setGscProperties] = useState<Array<{ siteUrl: string; permissionLevel?: string }>>([]);
  const [selectedGscProperty, setSelectedGscProperty] = useState(() => (localStorage.getItem('mediaflow_gsc_selected_site') || '').trim());
  const [gscLoadProgress, setGscLoadProgress] = useState({
    active: false,
    processed: 0,
    total: 0,
    updated: 0,
    currentUrl: '',
    currentAttempt: '',
    logs: [] as string[],
  });
  const [clusterProgress, setClusterProgress] = useState({
    active: false,
    attempt: 0,
    phase: 'idle',
    message: 'Aún no se ha iniciado la clusterización.',
    logs: [] as string[],
  });

  useEffect(() => {
    const token = localStorage.getItem('mediaflow_gsc_token');
    if (!token) return;

    listSites(token)
      .then((sites) => setGscProperties(sites as Array<{ siteUrl: string; permissionLevel?: string }>))
      .catch((error) => {
        console.error(error);
        setStatus('No se pudieron cargar propiedades GSC para clusterización KWs.');
      });
  }, []);

  useEffect(() => {
    if (!selectedGscProperty) return;
    localStorage.setItem('mediaflow_gsc_selected_site', selectedGscProperty);
  }, [selectedGscProperty]);

  useEffect(() => {
    if (gscProperties.length === 0) return;
    const currentExists = gscProperties.some((property) => property.siteUrl === selectedGscProperty);
    if (!currentExists) {
      setSelectedGscProperty(gscProperties[0].siteUrl || '');
    }
  }, [gscProperties, selectedGscProperty]);

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

  const filteredPages = useMemo(() => {
    const needle = urlFilter.trim().toLowerCase();
    if (!needle) return pages;
    return pages.filter((page) => page.url.toLowerCase().includes(needle));
  }, [pages, urlFilter]);

  const filteredKwCandidates = useMemo(() => {
    const urlNeedle = urlFilter.trim().toLowerCase();
    const kwNeedle = keywordFilter.trim().toLowerCase();
    return kwCandidates.filter((kw) => {
      const matchesUrl = !urlNeedle || kw.url.toLowerCase().includes(urlNeedle);
      const matchesKeyword = !kwNeedle || kw.keyword.toLowerCase().includes(kwNeedle);
      return matchesUrl && matchesKeyword;
    });
  }, [kwCandidates, keywordFilter, urlFilter]);

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

  const loadFreshGscKeywordsForPages = async (targetPages: SeoPage[], modeLabel: 'seleccionadas' | 'todas') => {
    if (targetPages.length === 0) {
      setStatus('Selecciona al menos 1 URL para cargar keywords desde GSC.');
      return;
    }
    const token = localStorage.getItem('mediaflow_gsc_token');
    const siteUrl = selectedGscProperty;
    if (!token || !siteUrl) {
      setStatus('Falta token o propiedad GSC activa. Conecta GSC en Dashboard y selecciona la propiedad.');
      return;
    }

    setLoading(true);
    try {
      const safeRangeDays = Number.isFinite(gscDateRangeDays) ? Math.min(Math.max(Math.trunc(gscDateRangeDays), 1), 365) : 56;
      const endDate = new Date().toISOString().slice(0, 10);
      const startDate = new Date(Date.now() - safeRangeDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      let updated = 0;
      const updates = [] as { id: string; changes: Partial<SeoPage> }[];
      const rowsByUrl = new Map<string, Array<{ query: string; clicks: number; impressions: number; ctr: number; position: number }>>();

      setStatus(`Cargando bloque único de queries GSC (query+page) para reducir peticiones por URL. Tramo: últimos ${safeRangeDays} días.`);
      const bulkResponse = await querySearchAnalyticsPaged(token, {
        siteUrl,
        startDate,
        endDate,
        dimensions: ['query', 'page'],
        allowHighCardinality: true,
        rowLimit: 25000,
        maxRows: 25000,
      });

      const selectedUrlVariants = new Map<string, string>();
      targetPages.forEach((page) => {
        buildUrlVariants(page.url).forEach((variant) => {
          const variantKey = normalizeUrlMatchKey(variant);
          if (variantKey) selectedUrlVariants.set(variantKey, page.url);
        });
      });

      (bulkResponse.rows || []).forEach((row: any) => {
        const query = String(row.keys?.[0] || row.query || '').trim();
        const pageUrl = String(row.keys?.[1] || row.page || '').trim();
        if (!query || !pageUrl) return;

        const normalizedPageUrlKey = normalizeUrlMatchKey(pageUrl);
        const canonicalUrl = selectedUrlVariants.get(normalizedPageUrlKey);
        if (!canonicalUrl) return;

        const list = rowsByUrl.get(canonicalUrl) || [];
        list.push({
          query,
          clicks: Number(row.clicks || 0),
          impressions: Number(row.impressions || 0),
          ctr: Number(row.ctr || 0),
          position: Number(row.position || 0),
        });
        rowsByUrl.set(canonicalUrl, list);
      });

      setGscLoadProgress({
        active: true,
        processed: 0,
        total: targetPages.length,
        updated: 0,
        currentUrl: '',
        currentAttempt: '',
        logs: [],
      });

      for (const [index, page] of targetPages.entries()) {
        const dedupByKeyword = new Map<string, { query: string; clicks: number; impressions: number; ctr: number; position: number }>();
        (rowsByUrl.get(page.url) || []).forEach((row) => {
          if (!row.query) return;
          const key = row.query.toLowerCase();
          const current = dedupByKeyword.get(key);
          if (!current || row.impressions > current.impressions || (row.impressions === current.impressions && row.clicks > current.clicks)) {
            dedupByKeyword.set(key, row);
          }
        });

        const rows = [...dedupByKeyword.values()]
          .sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks)
          .slice(0, 50);

        if (rows.length === 0) {
          setGscLoadProgress((prev) => ({
            ...prev,
            processed: index + 1,
            currentUrl: page.url,
            currentAttempt: 'sin datos en bloque',
            logs: [...prev.logs, `⚠️ ${page.url} sin resultados en carga unificada`].slice(-30),
          }));
          continue;
        }

        updates.push({
          id: page.id,
          changes: {
            checklist: {
              ...page.checklist,
              OPORTUNIDADES: {
                ...page.checklist.OPORTUNIDADES,
                autoData: {
                  ...(page.checklist.OPORTUNIDADES?.autoData || {}),
                  gscQueries: rows,
                },
              },
            },
          },
        });
        updated += 1;
        setGscLoadProgress((prev) => ({
          ...prev,
          processed: index + 1,
          updated,
          currentUrl: page.url,
          currentAttempt: 'bloque único',
          logs: [...prev.logs, `✅ ${page.url} cargada desde bloque único (${rows.length} kws)`].slice(-30),
        }));
      }

      if (updates.length > 0) onBulkUpdate(updates);
      setStatus(`Keywords GSC refrescadas para ${updated}/${targetPages.length} URLs ${modeLabel} (hasta 50 por URL, sin duplicados por URL y priorizadas por impresiones).`);
    } catch (error) {
      console.error(error);
      setStatus('Error cargando keywords GSC por URL.');
    } finally {
      setGscLoadProgress((prev) => ({ ...prev, active: false, currentAttempt: '' }));
      setLoading(false);
    }
  };


  const loadFreshGscKeywords = async () => loadFreshGscKeywordsForPages(selectedPages, 'seleccionadas');

  const loadFreshGscKeywordsForAllUrls = async () => {
    setSelectedPageIds(new Set(pages.map((page) => page.id)));
    setSelectionConfirmed(false);
    await loadFreshGscKeywordsForPages(pages, 'todas');
  };

  const handleGscDateRangeDaysChange = (value: string) => {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      setGscDateRangeDays(56);
      return;
    }
    setGscDateRangeDays(Math.min(Math.max(Math.trunc(parsed), 1), 365));
  };

  const handleQuickSelectKeywords = (mode: 'top3' | 'top4to10' | 'top10plus' | 'all') => {
    if (selectedPages.length === 0) {
      setStatus('Primero selecciona URLs para autoseleccionar keywords.');
      return;
    }

    const selectedUrlSet = new Set(selectedPages.map((page) => page.url));
    const next = new Set(selectedKeywordIds);
    const groupedByUrl = new Map<string, KwCandidate[]>();

    kwCandidates.forEach((kw) => {
      if (!selectedUrlSet.has(kw.url)) return;
      const list = groupedByUrl.get(kw.url) || [];
      list.push(kw);
      groupedByUrl.set(kw.url, list);
    });

    groupedByUrl.forEach((items) => {
      const ordered = [...items].sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions || a.keyword.localeCompare(b.keyword));
      if (mode === 'top3') {
        ordered.slice(0, 3).forEach((kw) => next.add(kw.id));
      } else if (mode === 'top4to10') {
        ordered.slice(3, 10).forEach((kw) => next.add(kw.id));
      } else if (mode === 'top10plus') {
        ordered.slice(10).forEach((kw) => next.add(kw.id));
      } else {
        ordered.forEach((kw) => next.add(kw.id));
      }
    });

    setSelectedKeywordIds(next);
    setSelectionConfirmed(false);
    const selectedCount = Array.from(next.values()).length;
    setStatus(
      mode === 'top3'
        ? `Selección rápida aplicada: top 3 keywords por URL (${selectedCount} keywords marcadas).`
        : mode === 'top4to10'
          ? `Selección rápida aplicada: posiciones 4 a 10 por URL (${selectedCount} keywords marcadas).`
          : mode === 'top10plus'
            ? `Selección rápida aplicada: posiciones +10 por URL (${selectedCount} keywords marcadas).`
            : `Selección rápida aplicada: todas las keywords de URLs seleccionadas (${selectedCount} keywords marcadas).`,
    );
  };

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
        const backendBaseUrl = resolveEngineUrl();

        setClusterProgress({
          active: true,
          attempt: 0,
          phase: 'starting',
          message: 'Preparando envío de keywords al backend...',
          logs: [`[${new Date().toLocaleTimeString()}] Iniciando clusterización de ${selectedKeywords.length} keywords.`],
        });

        const formData = new FormData();
        formData.append('keywords', selectedKeywords.map((kw) => kw.keyword).join('\n'));
        formData.append('mode', 'dataforseo');
        formData.append('dataforseo_detail', dataforseoDetail);
        formData.append('dataforseo_execution_mode', dataforseoExecutionMode);
        if (dataforseoLogin) formData.append('dataforseo_login', dataforseoLogin);
        if (dataforseoPassword) formData.append('dataforseo_password', dataforseoPassword);

        const startResponse = await fetch(`${backendBaseUrl}/seo/run`, { method: 'POST', body: formData });
        const startPayload = await startResponse.json();
        if (!startResponse.ok || startPayload?.status !== 'ok') {
          throw new Error(startPayload?.message || 'No se pudo iniciar la clusterización backend');
        }
        setClusterProgress((prev) => ({
          ...prev,
          phase: 'running',
          message: 'Backend iniciado. Consultando progreso y análisis SERP...',
          logs: [...prev.logs, `[${new Date().toLocaleTimeString()}] Job backend iniciado correctamente.`],
        }));

        let statusPayload: { active?: boolean; results?: BackendClusterResult[]; error?: string } = {};
        for (let attempt = 0; attempt < 90; attempt += 1) {
          const statusResponse = await fetch(`${backendBaseUrl}/seo/status`);
          statusPayload = await statusResponse.json();
          setClusterProgress((prev) => ({
            ...prev,
            attempt: attempt + 1,
            message: statusPayload.active
              ? `Analizando SERPs y clusterizando... sondeo ${attempt + 1}/90`
              : 'Backend finalizó el procesamiento. Aplicando resultados...',
            logs: [
              ...prev.logs.slice(-14),
              `[${new Date().toLocaleTimeString()}] Sondeo ${attempt + 1}: ${statusPayload.active ? 'en curso' : 'finalizado'}.`,
            ],
          }));
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
        return { id: page.id, changes: { cluster } };
      });
      onBulkUpdate(updates);
      const matched = selectedKeywords.filter((kw) => keywordClusterMap.has(kw.keyword.toLowerCase())).length;
      setStatus(`Clusterización KWs completada con ${useDataforseoForClusterization ? 'backend' : 'mapeo local'}. ${matched}/${selectedKeywords.length} keywords mapeadas.`);
      setClusterProgress((prev) => ({
        ...prev,
        active: false,
        phase: 'completed',
        message: `Proceso completado. ${matched}/${selectedKeywords.length} keywords mapeadas.`,
        logs: [...prev.logs, `[${new Date().toLocaleTimeString()}] Clusterización finalizada.`].slice(-15),
      }));
    } catch (e) {
      console.error(e);
      const message = e instanceof Error ? e.message : 'Error al clusterizar keywords.';
      setStatus(message);
      setClusterProgress((prev) => ({
        ...prev,
        active: false,
        phase: 'error',
        message,
        logs: [...prev.logs, `[${new Date().toLocaleTimeString()}] Error: ${message}`].slice(-15),
      }));
    } finally {
      setLoading(false);
    }
  };

    return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">{status}</p>
      <div className="rounded border p-3 space-y-2">
        <h3 className="font-semibold">Progreso de carga GSC por URL</h3>
        <p className="text-xs text-slate-700">
          Estado: {gscLoadProgress.active ? 'en curso' : 'inactivo'} · {gscLoadProgress.processed}/{gscLoadProgress.total} URLs procesadas · {gscLoadProgress.updated} con keywords.
        </p>
        <p className="text-xs text-slate-700">
          URL actual: {gscLoadProgress.currentUrl || '-'} · intento: {gscLoadProgress.currentAttempt || '-'}
        </p>
        <div className="max-h-28 overflow-auto rounded border bg-slate-50 p-2 text-xs text-slate-700 space-y-1">
          {gscLoadProgress.logs.length === 0 ? <p>Sin actividad todavía.</p> : gscLoadProgress.logs.map((line, idx) => <p key={`${line}-${idx}`}>{line}</p>)}
        </div>
      </div>
      <div className="rounded border p-3 space-y-2">
        <h3 className="font-semibold">Progreso clusterización KWs (backend)</h3>
        <p className="text-xs text-slate-700">
          Estado: {clusterProgress.active ? 'en curso' : 'inactivo'} · fase: {clusterProgress.phase} · sondeo: {clusterProgress.attempt}/90
        </p>
        <p className="text-xs text-slate-700">{clusterProgress.message}</p>
        <div className="max-h-28 overflow-auto rounded border bg-slate-50 p-2 text-xs text-slate-700 space-y-1">
          {clusterProgress.logs.length === 0 ? <p>Sin actividad todavía.</p> : clusterProgress.logs.map((line, idx) => <p key={`${line}-${idx}`}>{line}</p>)}
        </div>
      </div>
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
        <div>
          <label className="text-xs">Propiedad GSC (solo Clusterización KWs)</label>
          <select
            className="form-control"
            value={selectedGscProperty}
            onChange={(e) => setSelectedGscProperty(e.target.value)}
          >
            <option value="">Selecciona una propiedad</option>
            {gscProperties.map((property) => (
              <option key={property.siteUrl} value={property.siteUrl}>
                {property.siteUrl}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs">Tramo recopilación GSC (días)</label>
          <input
            type="number"
            min={1}
            max={365}
            className="form-control"
            value={gscDateRangeDays}
            onChange={(e) => handleGscDateRangeDaysChange(e.target.value)}
          />
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
          <input className="form-control mb-2" placeholder="Filtrar URLs" value={urlFilter} onChange={(e) => setUrlFilter(e.target.value)} />
          <div className="max-h-72 overflow-auto">
            <div className="min-w-[780px]">
              <div className="grid grid-cols-[24px_1.8fr_0.9fr_0.9fr_0.7fr_0.9fr_1fr] gap-2 border-b bg-slate-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                <span />
                <span>URL</span>
                <span>Tipo</span>
                <span>Punto 12</span>
                <span className="text-right">Clics</span>
                <span className="text-right">Impresiones</span>
                <span className="text-right">Posición media</span>
              </div>
              <div className="divide-y">
                {filteredPages.map((page) => {
                  const metrics = page.gscMetrics;
                  const position = typeof metrics?.position === 'number' ? metrics.position.toFixed(1) : '-';
                  const point12Status = resolvePoint12Status(page);
                  return (
                    <label key={page.id} className="grid grid-cols-[24px_1.8fr_0.9fr_0.9fr_0.7fr_0.9fr_1fr] items-start gap-2 px-2 py-1 text-xs text-slate-700">
                      <input type="checkbox" checked={selectedPageIds.has(page.id)} onChange={(e) => {
                        const next = new Set(selectedPageIds);
                        e.target.checked ? next.add(page.id) : next.delete(page.id);
                        setSelectedPageIds(next);
                        setSelectionConfirmed(false);
                      }} />
                      <span className="break-all">{page.url}</span>
                      <span>{page.pageType || '-'}</span>
                      <span>{CHECKLIST_STATUS_LABELS[point12Status] || CHECKLIST_STATUS_LABELS.NA}</span>
                      <span className="text-right">{metrics?.clicks ?? 0}</span>
                      <span className="text-right">{metrics?.impressions ?? 0}</span>
                      <span className="text-right">{position}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        <div className="rounded border p-3">
          <h3 className="font-semibold mb-2">Keywords disponibles (GSC + archivo)</h3>
          <input className="form-control mb-2" placeholder="Filtrar keywords" value={keywordFilter} onChange={(e) => setKeywordFilter(e.target.value)} />
          <div className="max-h-72 overflow-auto space-y-1">
            {filteredKwCandidates.map((kw) => (
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
        <Button onClick={loadFreshGscKeywordsForAllUrls} disabled={loading || pages.length === 0}>Cargar datos de URLs (recomendado)</Button>
        <Button onClick={loadFreshGscKeywords} disabled={loading || selectedPages.length === 0}>Subir datos GSC (solo URLs seleccionadas)</Button>
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

      <div className="rounded border p-3 space-y-2">
        <h3 className="font-semibold">Selección rápida de KWs</h3>
        <p className="text-xs text-slate-600">Acelera la selección de keywords para las URLs marcadas.</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => handleQuickSelectKeywords('top3')} disabled={loading || selectedPages.length === 0}>Top 3 por URL</Button>
          <Button onClick={() => handleQuickSelectKeywords('top4to10')} disabled={loading || selectedPages.length === 0}>Top 4-10 por URL</Button>
          <Button onClick={() => handleQuickSelectKeywords('top10plus')} disabled={loading || selectedPages.length === 0}>Top +10 por URL</Button>
          <Button onClick={() => handleQuickSelectKeywords('all')} disabled={loading || selectedPages.length === 0}>Todas por URL</Button>
        </div>
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

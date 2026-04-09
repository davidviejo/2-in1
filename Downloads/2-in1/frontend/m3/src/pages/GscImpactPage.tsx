import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, LogIn, LogOut, RefreshCcw, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { useGSCAuth } from '@/hooks/useGSCAuth';
import { useGSCData } from '@/hooks/useGSCData';
import { GSCRow } from '@/types';
import { getGSCQueryData, getGSCQueryPageData } from '@/services/googleSearchConsole';
import { inspectUrlsBatch, UrlInspectionErrorItem, UrlInspectionRow } from '@/services/gscInspectionService';

type SegmentFilter = 'all' | 'brand' | 'non_brand' | 'question';

type ImpactRow = {
  key: string;
  label: string;
  preClicks: number;
  rolloutClicks: number;
  postClicks: number;
  preImpressions: number;
  rolloutImpressions: number;
  postImpressions: number;
  prePosition: number;
  rolloutPosition: number;
  postPosition: number;
};

type UrlSampleRow = ImpactRow & {
  clickDelta: number;
  impressionDelta: number;
  positionDelta: number;
  severityScore: number;
};

interface PeriodRanges {
  pre: { start: string; end: string };
  rollout: { start: string; end: string };
  post: { start: string; end: string };
}

const toISODate = (date: Date) => date.toISOString().split('T')[0];

const sumRows = (rows: GSCRow[]) =>
  rows.reduce(
    (acc, row) => {
      acc.clicks += row.clicks;
      acc.impressions += row.impressions;
      return acc;
    },
    { clicks: 0, impressions: 0 },
  );

const aggregateByKey = (rows: GSCRow[], index: number) => {
  const map = new Map<string, { clicks: number; impressions: number; positionSum: number; positionWeight: number }>();

  rows.forEach((row) => {
    const key = row.keys[index] || 'Sin dato';
    const current = map.get(key) || { clicks: 0, impressions: 0, positionSum: 0, positionWeight: 0 };
    const weight = Math.max(row.impressions, 1);
    map.set(key, {
      clicks: current.clicks + row.clicks,
      impressions: current.impressions + row.impressions,
      positionSum: current.positionSum + row.position * weight,
      positionWeight: current.positionWeight + weight,
    });
  });

  return map;
};

const mergePeriods = (
  pre: Map<string, { clicks: number; impressions: number; positionSum: number; positionWeight: number }>,
  rollout: Map<string, { clicks: number; impressions: number; positionSum: number; positionWeight: number }>,
  post: Map<string, { clicks: number; impressions: number; positionSum: number; positionWeight: number }>,
): ImpactRow[] => {
  const keys = new Set<string>([...pre.keys(), ...rollout.keys(), ...post.keys()]);

  return Array.from(keys).map((key) => {
    const preValue = pre.get(key) || { clicks: 0, impressions: 0, positionSum: 0, positionWeight: 0 };
    const rolloutValue = rollout.get(key) || { clicks: 0, impressions: 0, positionSum: 0, positionWeight: 0 };
    const postValue = post.get(key) || { clicks: 0, impressions: 0, positionSum: 0, positionWeight: 0 };

    const avgPosition = (value: { positionSum: number; positionWeight: number }) =>
      value.positionWeight > 0 ? Number((value.positionSum / value.positionWeight).toFixed(2)) : 0;

    return {
      key,
      label: key,
      preClicks: preValue.clicks,
      rolloutClicks: rolloutValue.clicks,
      postClicks: postValue.clicks,
      preImpressions: preValue.impressions,
      rolloutImpressions: rolloutValue.impressions,
      postImpressions: postValue.impressions,
      prePosition: avgPosition(preValue),
      rolloutPosition: avgPosition(rolloutValue),
      postPosition: avgPosition(postValue),
    };
  });
};

const toSampleRow = (row: ImpactRow): UrlSampleRow => {
  const clickDelta = row.postClicks - row.preClicks;
  const impressionDelta = row.postImpressions - row.preImpressions;
  const positionDelta = row.postPosition - row.prePosition;
  const severityScore =
    Math.max(0, -clickDelta) * 3 +
    Math.max(0, -impressionDelta) * 0.5 +
    Math.max(0, positionDelta) * 40;

  return {
    ...row,
    clickDelta,
    impressionDelta,
    positionDelta,
    severityScore,
  };
};

const getActionableSignals = (row: UrlInspectionRow): string[] => {
  const signals: string[] = [];
  if (row.coverageState && !/submitted and indexed|indexed/i.test(row.coverageState)) {
    signals.push('Revisar cobertura/indexación');
  }
  if (row.indexingState && /blocked|not indexed|soft 404/i.test(row.indexingState)) {
    signals.push('Validar bloqueo/no index');
  }
  if (row.userCanonical && row.googleCanonical && row.userCanonical !== row.googleCanonical) {
    signals.push('Canónica declarada != Google');
  }
  if (row.pageFetchState && row.pageFetchState !== 'SUCCESSFUL') {
    signals.push('Error de fetch por Googlebot');
  }
  if (row.robotsTxtState && row.robotsTxtState !== 'ALLOWED') {
    signals.push('Revisar robots.txt');
  }
  if (signals.length === 0) {
    signals.push('Sin bloqueadores críticos detectados');
  }
  return signals;
};

const buildDefaultRanges = (rolloutDate: string): PeriodRanges => {
  const rollout = new Date(`${rolloutDate}T00:00:00Z`);

  const preEnd = new Date(rollout);
  preEnd.setUTCDate(preEnd.getUTCDate() - 1);
  const preStart = new Date(preEnd);
  preStart.setUTCDate(preStart.getUTCDate() - 27);

  const rolloutStart = new Date(rollout);
  rolloutStart.setUTCDate(rolloutStart.getUTCDate() - 6);
  const rolloutEnd = new Date(rollout);
  rolloutEnd.setUTCDate(rolloutEnd.getUTCDate() + 7);

  const postStart = new Date(rollout);
  postStart.setUTCDate(postStart.getUTCDate() + 1);
  const postEnd = new Date(postStart);
  postEnd.setUTCDate(postEnd.getUTCDate() + 27);
  const today = new Date();

  return {
    pre: { start: toISODate(preStart), end: toISODate(preEnd) },
    rollout: { start: toISODate(rolloutStart), end: toISODate(rolloutEnd) },
    post: { start: toISODate(postStart), end: toISODate(postEnd > today ? today : postEnd) },
  };
};

const matchesSegment = (text: string, segmentFilter: SegmentFilter, brandTerm: string) => {
  const normalized = text.toLowerCase();
  const brand = brandTerm.trim().toLowerCase();

  if (segmentFilter === 'brand') {
    return brand.length > 0 && normalized.includes(brand);
  }

  if (segmentFilter === 'non_brand') {
    return brand.length === 0 ? true : !normalized.includes(brand);
  }

  if (segmentFilter === 'question') {
    return normalized.startsWith('como') || normalized.startsWith('qué') || normalized.startsWith('how');
  }

  return true;
};

const GscImpactPage: React.FC = () => {
  const [rolloutDate, setRolloutDate] = useState(() => toISODate(new Date()));
  const [siteSearch, setSiteSearch] = useState('');
  const [segmentFilter, setSegmentFilter] = useState<SegmentFilter>('all');
  const [brandTerm, setBrandTerm] = useState('');
  const [minImpressions, setMinImpressions] = useState(50);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [impactError, setImpactError] = useState<string | null>(null);
  const [inspectionRows, setInspectionRows] = useState<UrlInspectionRow[]>([]);
  const [inspectionErrors, setInspectionErrors] = useState<UrlInspectionErrorItem[]>([]);
  const [isInspecting, setIsInspecting] = useState(false);
  const [inspectionStatus, setInspectionStatus] = useState<string | null>(null);

  const [queryRows, setQueryRows] = useState<ImpactRow[]>([]);
  const [urlRows, setUrlRows] = useState<ImpactRow[]>([]);

  const {
    gscAccessToken,
    googleUser,
    clientId,
    showGscConfig,
    setShowGscConfig,
    handleSaveClientId,
    handleLogoutGsc,
    login,
    setClientId,
  } = useGSCAuth();

  const { gscSites, selectedSite, setSelectedSite, gscData, comparisonGscData, isLoadingGsc } =
    useGSCData(gscAccessToken);

  const filteredSites = useMemo(() => {
    const q = siteSearch.trim().toLowerCase();
    if (!q) return gscSites;
    return gscSites.filter((site) => site.siteUrl.toLowerCase().includes(q));
  }, [gscSites, siteSearch]);

  const ranges = useMemo(() => buildDefaultRanges(rolloutDate), [rolloutDate]);

  useEffect(() => {
    const fetchImpact = async () => {
      if (!gscAccessToken || !selectedSite) return;

      setLoadingImpact(true);
      setImpactError(null);

      try {
        const [
          preQuery,
          rolloutQuery,
          postQuery,
          preQueryPage,
          rolloutQueryPage,
          postQueryPage,
        ] = await Promise.all([
          getGSCQueryData(gscAccessToken, selectedSite, ranges.pre.start, ranges.pre.end, 1000),
          getGSCQueryData(
            gscAccessToken,
            selectedSite,
            ranges.rollout.start,
            ranges.rollout.end,
            1000,
          ),
          getGSCQueryData(gscAccessToken, selectedSite, ranges.post.start, ranges.post.end, 1000),
          getGSCQueryPageData(gscAccessToken, selectedSite, ranges.pre.start, ranges.pre.end, 1200),
          getGSCQueryPageData(
            gscAccessToken,
            selectedSite,
            ranges.rollout.start,
            ranges.rollout.end,
            1200,
          ),
          getGSCQueryPageData(gscAccessToken, selectedSite, ranges.post.start, ranges.post.end, 1200),
        ]);

        const queryMerged = mergePeriods(
          aggregateByKey(preQuery, 0),
          aggregateByKey(rolloutQuery, 0),
          aggregateByKey(postQuery, 0),
        );

        const urlMerged = mergePeriods(
          aggregateByKey(preQueryPage, 1),
          aggregateByKey(rolloutQueryPage, 1),
          aggregateByKey(postQueryPage, 1),
        );

        setQueryRows(queryMerged);
        setUrlRows(urlMerged);
      } catch (error) {
        setImpactError(
          error instanceof Error
            ? error.message
            : 'No se pudieron cargar los bloques pre/rollout/post desde Search Console.',
        );
      } finally {
        setLoadingImpact(false);
      }
    };

    void fetchImpact();
  }, [gscAccessToken, selectedSite, ranges, refreshTick]);

  const gscSummary = useMemo(() => {
    const current = sumRows(gscData);
    const previous = sumRows(comparisonGscData);
    const clickDelta = current.clicks - previous.clicks;
    const impressionDelta = current.impressions - previous.impressions;

    return {
      current,
      previous,
      clickDelta,
      impressionDelta,
    };
  }, [gscData, comparisonGscData]);

  const filteredQueryRows = useMemo(() => {
    return queryRows
      .filter((row) => matchesSegment(row.label, segmentFilter, brandTerm))
      .filter((row) => Math.max(row.preImpressions, row.rolloutImpressions, row.postImpressions) >= minImpressions);
  }, [queryRows, segmentFilter, brandTerm, minImpressions]);

  const filteredUrlRows = useMemo(() => {
    return urlRows.filter(
      (row) => Math.max(row.preImpressions, row.rolloutImpressions, row.postImpressions) >= minImpressions,
    );
  }, [urlRows, minImpressions]);

  const topQueryWinners = useMemo(
    () =>
      [...filteredQueryRows]
        .sort((a, b) => b.postClicks - b.preClicks - (a.postClicks - a.preClicks))
        .slice(0, 8),
    [filteredQueryRows],
  );

  const topQueryLosers = useMemo(
    () =>
      [...filteredQueryRows]
        .sort((a, b) => a.postClicks - a.preClicks - (b.postClicks - b.preClicks))
        .slice(0, 8),
    [filteredQueryRows],
  );

  const topUrlWinners = useMemo(
    () =>
      [...filteredUrlRows]
        .sort((a, b) => b.postClicks - b.preClicks - (a.postClicks - a.preClicks))
        .slice(0, 8),
    [filteredUrlRows],
  );

  const topUrlLosers = useMemo(
    () =>
      [...filteredUrlRows]
        .sort((a, b) => a.postClicks - a.preClicks - (b.postClicks - b.preClicks))
        .slice(0, 8),
    [filteredUrlRows],
  );

  const sampledAffectedUrls = useMemo(() => {
    return filteredUrlRows
      .map(toSampleRow)
      .filter((row) => row.clickDelta < 0 || row.impressionDelta < 0 || row.positionDelta > 0)
      .sort((a, b) => b.severityScore - a.severityScore)
      .slice(0, 10);
  }, [filteredUrlRows]);

  const inspectSampledUrls = async () => {
    if (!selectedSite || sampledAffectedUrls.length === 0) {
      setInspectionStatus('No hay URLs afectadas para inspeccionar en esta vista.');
      return;
    }

    setIsInspecting(true);
    setInspectionRows([]);
    setInspectionErrors([]);
    setInspectionStatus('Iniciando inspección de URLs afectadas…');

    try {
      const response = await inspectUrlsBatch(
        selectedSite,
        sampledAffectedUrls.map((row) => row.key),
        { retries: 1 },
      );
      setInspectionRows(response.results || []);
      setInspectionErrors(response.errors || []);

      if (response.meta?.quotaHit) {
        setInspectionStatus('Se alcanzó cuota parcial de URL Inspection. Muestra incompleta; reintenta más tarde.');
      } else if (response.status === 'partial') {
        setInspectionStatus('Inspección parcial: algunas URLs no pudieron evaluarse.');
      } else if (response.status === 'error') {
        setInspectionStatus('No se pudo completar la inspección de URLs en backend.');
      } else {
        setInspectionStatus(`Inspección completada: ${response.meta.successCount} URLs procesadas.`);
      }
    } catch (error) {
      setInspectionStatus(
        error instanceof Error
          ? `Error inspeccionando URLs: ${error.message}`
          : 'Error inesperado inspeccionando URLs.',
      );
    } finally {
      setIsInspecting(false);
    }
  };

  return (
    <div className="page-shell pb-20">
      <header className="surface-panel p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-brand-md bg-primary-soft p-3 text-primary">
              <BarChart3 size={24} />
            </div>
            <div>
              <h1 className="section-title">Impacto GSC por rollout</h1>
              <p className="section-subtitle">Análisis solo Search Console (sin GA4).</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!gscAccessToken ? (
              <Button onClick={() => login()}>
                <LogIn size={16} />
                Conectar Search Console (sin GA4)
              </Button>
            ) : (
              <>
                <Button variant="secondary" onClick={() => setShowGscConfig(true)}>
                  <Settings2 size={16} />
                  Configurar Client ID
                </Button>
                <Button variant="ghost" onClick={handleLogoutGsc}>
                  <LogOut size={16} />
                  Cerrar sesión GSC
                </Button>
              </>
            )}
          </div>
        </div>
        {googleUser && (
          <p className="section-subtitle">Conectado como {googleUser.email}. Módulo solo Search Console (sin GA4).</p>
        )}
      </header>

      {!gscAccessToken ? (
        <Card className="p-6">
          <p className="section-subtitle">
            Para usar esta vista debes autenticarte con Google Search Console. Este reporte funciona solo Search Console (sin GA4).
          </p>
        </Card>
      ) : (
        <>
          <section className="surface-panel p-6">
            <h2 className="text-lg font-semibold">Resumen ejecutivo (solo Search Console, sin GA4)</h2>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="metric-chip">
                <p className="metric-label">Clics periodo actual</p>
                <p className="text-2xl font-bold">{gscSummary.current.clicks.toLocaleString('es-ES')}</p>
              </div>
              <div className="metric-chip">
                <p className="metric-label">Clics comparativo</p>
                <p className="text-2xl font-bold">{gscSummary.previous.clicks.toLocaleString('es-ES')}</p>
              </div>
              <div className="metric-chip">
                <p className="metric-label">Delta clics</p>
                <p className="text-2xl font-bold">{gscSummary.clickDelta.toLocaleString('es-ES')}</p>
              </div>
              <div className="metric-chip">
                <p className="metric-label">Delta impresiones</p>
                <p className="text-2xl font-bold">{gscSummary.impressionDelta.toLocaleString('es-ES')}</p>
              </div>
            </div>
          </section>

          <section className="surface-panel p-6">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
              <div className="lg:col-span-2">
                <label className="metric-label">Propiedad Search Console (sin GA4)</label>
                <Input
                  value={siteSearch}
                  onChange={(e) => setSiteSearch(e.target.value)}
                  placeholder="Filtrar propiedad"
                />
                <select
                  className="form-control mt-2"
                  value={selectedSite}
                  onChange={(e) => setSelectedSite(e.target.value)}
                >
                  {filteredSites.map((site) => (
                    <option key={site.siteUrl} value={site.siteUrl}>
                      {site.siteUrl}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="metric-label">Fecha rollout</label>
                <input
                  className="form-control"
                  type="date"
                  value={rolloutDate}
                  onChange={(e) => setRolloutDate(e.target.value)}
                />
              </div>

              <div>
                <label className="metric-label">Segmentación query</label>
                <select
                  className="form-control"
                  value={segmentFilter}
                  onChange={(e) => setSegmentFilter(e.target.value as SegmentFilter)}
                >
                  <option value="all">Todo</option>
                  <option value="brand">Brand</option>
                  <option value="non_brand">Non-brand</option>
                  <option value="question">Preguntas</option>
                </select>
              </div>

              <div>
                <label className="metric-label">Filtro mínimo impresiones</label>
                <input
                  className="form-control"
                  type="number"
                  min={0}
                  value={minImpressions}
                  onChange={(e) => setMinImpressions(Number(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="metric-label">Término de marca (solo Search Console)</label>
                <Input
                  value={brandTerm}
                  onChange={(e) => setBrandTerm(e.target.value)}
                  placeholder="ejemplo: mediaflow"
                />
              </div>
              <div className="surface-subtle p-3 text-sm">
                <p>
                  Comparativa pre/rollout/post basada en Search Console: pre ({ranges.pre.start} → {ranges.pre.end}), rollout ({ranges.rollout.start} → {ranges.rollout.end}), post ({ranges.post.start} → {ranges.post.end}).
                </p>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <Button variant="secondary" onClick={() => setRefreshTick((value) => value + 1)}>
                <RefreshCcw size={16} />
                Refrescar bloque pre/rollout/post
              </Button>
              {(isLoadingGsc || loadingImpact) && <Spinner size={18} />}
            </div>
            {impactError && <p className="mt-2 text-sm text-danger">{impactError}</p>}
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Card className="p-5">
              <h3 className="text-lg font-semibold">Winners por query (solo Search Console, sin GA4)</h3>
              <div className="mt-3 space-y-2">
                {topQueryWinners.map((row) => (
                  <div key={`qw-${row.key}`} className="surface-subtle p-3 text-sm">
                    <p className="font-medium">{row.label}</p>
                    <p className="text-muted">Pre {row.preClicks} · Rollout {row.rolloutClicks} · Post {row.postClicks}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="text-lg font-semibold">Losers por query (solo Search Console, sin GA4)</h3>
              <div className="mt-3 space-y-2">
                {topQueryLosers.map((row) => (
                  <div key={`ql-${row.key}`} className="surface-subtle p-3 text-sm">
                    <p className="font-medium">{row.label}</p>
                    <p className="text-muted">Pre {row.preClicks} · Rollout {row.rolloutClicks} · Post {row.postClicks}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="text-lg font-semibold">Winners por URL (solo Search Console, sin GA4)</h3>
              <div className="mt-3 space-y-2">
                {topUrlWinners.map((row) => (
                  <div key={`uw-${row.key}`} className="surface-subtle p-3 text-sm">
                    <p className="font-medium truncate">{row.label}</p>
                    <p className="text-muted">Pre {row.preClicks} · Rollout {row.rolloutClicks} · Post {row.postClicks}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="text-lg font-semibold">Losers por URL (solo Search Console, sin GA4)</h3>
              <div className="mt-3 space-y-2">
                {topUrlLosers.map((row) => (
                  <div key={`ul-${row.key}`} className="surface-subtle p-3 text-sm">
                    <p className="font-medium truncate">{row.label}</p>
                    <p className="text-muted">Pre {row.preClicks} · Rollout {row.rolloutClicks} · Post {row.postClicks}</p>
                  </div>
                ))}
              </div>
            </Card>
          </section>

          <section className="surface-panel p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">URLs inspeccionadas (URL Inspection)</h3>
                <p className="section-subtitle">
                  Muestra automática de URLs afectadas por caída de clics/impresiones o peor delta de posición.
                </p>
              </div>
              <Button onClick={() => void inspectSampledUrls()} disabled={isInspecting || sampledAffectedUrls.length === 0}>
                {isInspecting ? <Spinner size={16} /> : null}
                Inspeccionar muestra ({sampledAffectedUrls.length})
              </Button>
            </div>

            {inspectionStatus && <p className="mt-3 text-sm text-muted">{inspectionStatus}</p>}

            {sampledAffectedUrls.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted">
                      <th className="px-2 py-2">URL</th>
                      <th className="px-2 py-2">Δ clicks</th>
                      <th className="px-2 py-2">Δ imp</th>
                      <th className="px-2 py-2">Δ pos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sampledAffectedUrls.map((row) => (
                      <tr key={`sample-${row.key}`} className="border-t border-border/50">
                        <td className="max-w-[480px] truncate px-2 py-2">{row.key}</td>
                        <td className="px-2 py-2">{row.clickDelta}</td>
                        <td className="px-2 py-2">{row.impressionDelta}</td>
                        <td className="px-2 py-2">{row.positionDelta.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {inspectionRows.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted">
                      <th className="px-2 py-2">URL</th>
                      <th className="px-2 py-2">Coverage</th>
                      <th className="px-2 py-2">Indexing</th>
                      <th className="px-2 py-2">Último crawl</th>
                      <th className="px-2 py-2">Canónica Google</th>
                      <th className="px-2 py-2">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inspectionRows.map((row) => (
                      <tr key={`inspection-${row.url}`} className="border-t border-border/50">
                        <td className="max-w-[360px] truncate px-2 py-2">{row.url}</td>
                        <td className="px-2 py-2">{row.coverageState}</td>
                        <td className="px-2 py-2">{row.indexingState}</td>
                        <td className="px-2 py-2">{row.lastCrawlTime ? new Date(row.lastCrawlTime).toLocaleString('es-ES') : '-'}</td>
                        <td className="max-w-[280px] truncate px-2 py-2">{row.googleCanonical || '-'}</td>
                        <td className="px-2 py-2">{getActionableSignals(row).join(' · ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {inspectionErrors.length > 0 && (
              <div className="mt-4 space-y-2">
                {inspectionErrors.map((item) => (
                  <p key={`inspection-error-${item.url}`} className="text-sm text-danger">
                    {item.url}: {item.error.code} {item.error.message ? `- ${item.error.message}` : ''}
                  </p>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {showGscConfig && (
        <Modal isOpen={showGscConfig} onClose={() => setShowGscConfig(false)} title="Configurar OAuth de Search Console">
          <div className="space-y-3">
            <p className="section-subtitle">Esta configuración aplica solo a Search Console (sin GA4).</p>
            <Input
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="Google OAuth Client ID"
            />
            <div className="flex justify-end">
              <Button onClick={() => handleSaveClientId(clientId)}>Guardar Client ID</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default GscImpactPage;

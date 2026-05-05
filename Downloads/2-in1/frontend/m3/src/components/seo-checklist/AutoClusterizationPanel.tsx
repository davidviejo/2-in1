import React, { useMemo, useState } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { SeoPage } from '../../types/seoChecklist';
import { HttpClientError } from '../../services/httpClient';
import { openaiApi, ClusterizeAiRequestItem, ClusterizeAiResponse } from '../../services/openaiApi';

type UrlSourceMode = 'existing' | 'existing_gsc' | 'manual';
type ClusterMode = 'url' | 'scrape' | 'ai_headers';

interface ClusterCandidate {
  id: string;
  url: string;
  title?: string;
  h1?: string;
  source: 'existing' | 'gsc' | 'manual';
}

interface ClusterProposal {
  id: string;
  url: string;
  cluster: string;
  reason: string;
  source: ClusterCandidate['source'];
}

interface Props {
  pages: SeoPage[];
  onBulkUpdate: (updates: { id: string; changes: Partial<SeoPage> }[]) => void;
}

const normalizeToken = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const inferClusterFromUrl = (url: string, depth = 1) => {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length === 0) return 'home';
    return segments.slice(0, depth).map(normalizeToken).join(' / ') || 'general';
  } catch {
    return normalizeToken(url).split('/').slice(0, depth).join(' / ') || 'general';
  }
};

const parseManualUrls = (rawInput: string): ClusterCandidate[] => {
  const seen = new Set<string>();
  return rawInput
    .split(/\n|,|\t/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => {
      if (seen.has(line)) return false;
      seen.add(line);
      return true;
    })
    .map((url, idx) => ({
      id: `manual-${idx}-${url}`,
      url,
      source: 'manual' as const,
    }));
};

const scrapeUrlMetadata = async (url: string): Promise<Pick<ClusterCandidate, 'title' | 'h1'>> => {
  const response = await fetch(url);
  const html = await response.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const title = doc.querySelector('title')?.textContent?.trim() || '';
  const h1 = doc.querySelector('h1')?.textContent?.trim() || '';
  return { title, h1 };
};

const inferClusterFromMetadata = (candidate: ClusterCandidate): { cluster: string; reason: string } => {
  const text = normalizeToken([candidate.title, candidate.h1].filter(Boolean).join(' '));
  if (!text) {
    return {
      cluster: inferClusterFromUrl(candidate.url),
      reason: 'Fallback a estructura de URL (no se detectó title/H1).',
    };
  }

  const tokens = text
    .split(' ')
    .filter((token) => token.length > 3)
    .slice(0, 4);

  return {
    cluster: tokens.join(' ') || inferClusterFromUrl(candidate.url),
    reason: 'Cluster inferido con title/H1 scrapeados.',
  };
};

export const AutoClusterizationPanel: React.FC<Props> = ({ pages, onBulkUpdate }) => {
  const [urlSourceMode, setUrlSourceMode] = useState<UrlSourceMode>('existing');
  const [existingUrlScope, setExistingUrlScope] = useState<'all' | 'pending'>('pending');
  const [clusterMode, setClusterMode] = useState<ClusterMode>('url');
  const [manualUrls, setManualUrls] = useState('');
  const [urlDepth, setUrlDepth] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState('');
  const [proposals, setProposals] = useState<ClusterProposal[]>([]);

  const sourceCandidates = useMemo<ClusterCandidate[]>(() => {
    if (urlSourceMode === 'manual') return parseManualUrls(manualUrls);

    const filteredBySource =
      urlSourceMode === 'existing_gsc'
        ? pages.filter((page) => (page.gscMetrics?.clicks || 0) > 0)
        : pages;

    const filtered =
      existingUrlScope === 'pending'
        ? filteredBySource.filter((page) => !(page.cluster || '').trim())
        : filteredBySource;

    return filtered.map((page) => ({
      id: page.id,
      url: page.url,
      source: urlSourceMode === 'existing_gsc' ? 'gsc' : 'existing',
    }));
  }, [existingUrlScope, manualUrls, pages, urlSourceMode]);

  const runClusterization = async () => {
    if (sourceCandidates.length === 0) {
      setStatus('No hay URLs para clusterizar con la fuente seleccionada.');
      setProposals([]);
      return;
    }

    setIsProcessing(true);
    setStatus('Procesando clusterización automática...');

    try {
      if (clusterMode === 'url') {
        const next = sourceCandidates.map((candidate) => ({
          id: candidate.id,
          url: candidate.url,
          source: candidate.source,
          cluster: inferClusterFromUrl(candidate.url, urlDepth),
          reason: `Cluster por estructura de URL (profundidad ${urlDepth}).`,
        }));
        setProposals(next);
        setStatus(`Clusterización finalizada: ${next.length} propuestas.`);
        return;
      }

      const scraped = await Promise.all(
        sourceCandidates.map(async (candidate) => {
          try {
            const metadata = await scrapeUrlMetadata(candidate.url);
            return { ...candidate, ...metadata };
          } catch {
            return candidate;
          }
        }),
      );

      if (clusterMode === 'scrape') {
        const next = scraped.map((candidate) => {
          const inferred = inferClusterFromMetadata(candidate);
          return {
            id: candidate.id,
            url: candidate.url,
            source: candidate.source,
            cluster: inferred.cluster,
            reason: inferred.reason,
          };
        });

        setProposals(next);
        setStatus(`Clusterización por scraping finalizada: ${next.length} propuestas.`);
        return;
      }

      const payload: ClusterizeAiRequestItem[] = scraped.map((item) => ({
        id: item.id,
        url: item.url,
        title: item.title || '',
        h1: item.h1 || '',
      }));

      const parsed: ClusterizeAiResponse = await openaiApi.clusterize(payload);

      const map = new Map((parsed.clusters || []).map((item) => [item.id, item]));
      const next = scraped.map((candidate) => {
        const ai = map.get(candidate.id);
        return {
          id: candidate.id,
          url: candidate.url,
          source: candidate.source,
          cluster: ai?.cluster || inferClusterFromMetadata(candidate).cluster,
          reason: ai?.reason || 'Fallback heurístico por falta de respuesta IA.',
        };
      });

      setProposals(next);
      setStatus(`Clusterización IA finalizada: ${next.length} propuestas.`);
    } catch (error) {
      console.error('Auto clusterization error', error);
      if (error instanceof HttpClientError && error.status === 424) {
        setStatus('OpenAI no configurado en servidor. Ve a Ajustes (⚙️).');
      } else if (error instanceof HttpClientError && (error.status === 401 || error.status === 403)) {
        setStatus('No autorizado. Inicia sesión de nuevo para clusterizar con IA.');
      } else {
        setStatus('Error en la clusterización automática. Revisa la configuración del servidor.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const applyApprovedClusters = () => {
    const updates = proposals
      .filter((proposal) => !proposal.id.startsWith('manual-'))
      .map((proposal) => ({
        id: proposal.id,
        changes: { cluster: proposal.cluster },
      }));

    if (updates.length === 0) {
      setStatus('No hay URLs existentes para aplicar. Las URLs manuales son solo vista previa.');
      return;
    }

    onBulkUpdate(updates);
    setStatus(`Aprobación aplicada: ${updates.length} URLs enviadas a Análisis SEO y Clusters.`);
  };

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Auto-clusterización de URLs</h2>
        <p className="text-sm text-slate-600">
          Genera propuestas de clusterización y apruébalas antes de pasarlas a la pestaña oficial.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">Fuente de URLs</label>
          <select
            value={urlSourceMode}
            onChange={(event) => setUrlSourceMode(event.target.value as UrlSourceMode)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="existing">URLs existentes (pestaña oficial)</option>
            <option value="existing_gsc">URLs existentes con datos GSC</option>
            <option value="manual">URLs manuales / scrapeadas</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">Modo de clusterización</label>
          <select
            value={clusterMode}
            onChange={(event) => setClusterMode(event.target.value as ClusterMode)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="url">1) Según estructura de URL</option>
            <option value="scrape">2) Según scraping (title + H1)</option>
            <option value="ai_headers">3) Con IA usando encabezados/title</option>
          </select>
        </div>
      </div>



      {urlSourceMode !== 'manual' && (
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">Alcance de URLs existentes</label>
          <select
            value={existingUrlScope}
            onChange={(event) => setExistingUrlScope(event.target.value as 'all' | 'pending')}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="pending">Solo URLs sin cluster asignado</option>
            <option value="all">Todas las URLs (reclusterizar)</option>
          </select>
        </div>
      )}

      {clusterMode === 'url' && (
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">Profundidad URL</label>
          <input
            type="number"
            min={1}
            max={4}
            value={urlDepth}
            onChange={(event) => setUrlDepth(Number(event.target.value) || 1)}
            className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      )}

      {urlSourceMode === 'manual' && (
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">URLs a clusterizar</label>
          <textarea
            rows={5}
            value={manualUrls}
            onChange={(event) => setManualUrls(event.target.value)}
            placeholder="https://dominio.com/categoria/url-1\nhttps://dominio.com/categoria/url-2"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={runClusterization} disabled={isProcessing}>
          {isProcessing ? 'Procesando...' : 'Ejecutar clusterización'}
        </Button>
        <Button variant="secondary" onClick={applyApprovedClusters} disabled={proposals.length === 0}>
          Aprobar y pasar a Análisis SEO y Clusters
        </Button>
      </div>

      {status && <p className="text-sm text-slate-600">{status}</p>}

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2">URL</th>
              <th className="px-3 py-2">Cluster propuesto</th>
              <th className="px-3 py-2">Fuente</th>
              <th className="px-3 py-2">Justificación</th>
            </tr>
          </thead>
          <tbody>
            {proposals.map((proposal) => (
              <tr key={`${proposal.id}-${proposal.url}`} className="border-t border-slate-100">
                <td className="px-3 py-2 text-xs text-slate-700">{proposal.url}</td>
                <td className="px-3 py-2 font-medium text-slate-900">{proposal.cluster}</td>
                <td className="px-3 py-2 text-slate-600">{proposal.source}</td>
                <td className="px-3 py-2 text-slate-600">{proposal.reason}</td>
              </tr>
            ))}
            {proposals.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-slate-500">
                  Aún no hay propuestas. Ejecuta una de las 3 opciones de clusterización.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

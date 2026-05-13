import React, { useMemo, useState } from 'react';
import { useSeoChecklist } from '@/hooks/useSeoChecklist';
import { Upload, Layers3, Regex, Link2, Table2 } from 'lucide-react';

type UploadedKeyword = {
  page: string;
  primary: string;
  secondary: string;
  others: string[];
};

const parseSheetLikeText = (content: string): UploadedKeyword[] => {
  const rows = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (rows.length <= 1) return [];

  return rows.slice(1).map((row) => {
    const [page = '', primary = '', secondary = '', others = ''] = row.split(',').map((value) => value.trim());
    return {
      page,
      primary,
      secondary,
      others: others.split('|').map((value) => value.trim()).filter(Boolean).slice(0, 10),
    };
  });
};

const UnifiedClusterWorkflowPage: React.FC = () => {
  const { pages } = useSeoChecklist();
  const [regexRules, setRegexRules] = useState('^/blog/ => Nivel 1: Blog\n^/categoria/seo/ => Nivel 2: SEO\n^/categoria/seo/local/ => Nivel 3: SEO Local');
  const [uploadedKeywords, setUploadedKeywords] = useState<UploadedKeyword[]>([]);

  const mSummary = useMemo(() => {
    const completed = pages.filter((page) => page.status === 'completed').length;
    const inProgress = pages.filter((page) => page.status === 'in_progress').length;
    return { total: pages.length, completed, inProgress, pending: Math.max(pages.length - completed - inProgress, 0) };
  }, [pages]);

  const keywordClusterRows = useMemo(() => {
    return pages
      .map((page) => ({
        url: page.url,
        kwPrincipal: page.targetKeyword || '-',
        kwSecundarias: page.secondaryKeywords?.slice(0, 2) || [],
        otrasKws: page.opportunityKeywords?.slice(0, 10) || [],
      }))
      .slice(0, 30);
  }, [pages]);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setUploadedKeywords(parseSheetLikeText(text));
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <section className="card p-5">
        <h1 className="text-2xl font-semibold">Flujo único: Auditoría + Agrupación + Clusterización</h1>
        <p className="text-sm text-slate-500 mt-2">Una sola pestaña para ejecutar todo el proceso sin salir de esta vista.</p>
      </section>

      <section className="card p-5">
        <h2 className="text-lg font-semibold mb-3">1) Resumen de auditoría (M1, M2, M3...)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl border p-3"><p className="text-xs text-slate-500">Total URLs</p><p className="text-xl font-bold">{mSummary.total}</p></div>
          <div className="rounded-xl border p-3"><p className="text-xs text-slate-500">Completadas</p><p className="text-xl font-bold">{mSummary.completed}</p></div>
          <div className="rounded-xl border p-3"><p className="text-xs text-slate-500">En progreso</p><p className="text-xl font-bold">{mSummary.inProgress}</p></div>
          <div className="rounded-xl border p-3"><p className="text-xs text-slate-500">Pendientes</p><p className="text-xl font-bold">{mSummary.pending}</p></div>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Layers3 size={18} />2) Agrupación y Clusterización</h2>
        <p className="text-sm text-slate-500 mb-3">Bloque central para revisar URLs y campos existentes de cluster.</p>
        <div className="max-h-72 overflow-auto border rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-slate-50"><tr><th className="p-2 text-left">URL</th><th className="p-2 text-left">KW principal</th><th className="p-2 text-left">Cluster</th></tr></thead>
            <tbody>
              {pages.slice(0, 20).map((page) => (
                <tr key={page.id} className="border-t"><td className="p-2">{page.url}</td><td className="p-2">{page.targetKeyword || '-'}</td><td className="p-2">{page.cluster || 'Sin cluster'}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Regex size={18} />3) Reglas Regex por niveles (1,2,3,4...)</h2>
        <textarea value={regexRules} onChange={(e) => setRegexRules(e.target.value)} rows={6} className="w-full rounded-xl border p-3 font-mono text-sm" />
      </section>

      <section className="card p-5">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Link2 size={18} />4) Clusterización de KWs con DataForSEO (GSC no principal/secundaria)</h2>
        <p className="text-sm text-slate-500 mb-3">Incluye hasta 10 keywords adicionales por página para clusterizar.</p>
        <div className="max-h-80 overflow-auto border rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-slate-50"><tr><th className="p-2 text-left">Página</th><th className="p-2 text-left">KW principal</th><th className="p-2 text-left">KW secundaria</th><th className="p-2 text-left">Otras KWs (max 10)</th></tr></thead>
            <tbody>
              {keywordClusterRows.map((row) => (
                <tr key={row.url} className="border-t"><td className="p-2">{row.url}</td><td className="p-2">{row.kwPrincipal}</td><td className="p-2">{row.kwSecundarias.join(', ') || '-'}</td><td className="p-2">{row.otrasKws.join(', ') || '-'}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Upload size={18} />5) Subida de Sheet de asignaciones</h2>
        <p className="text-sm text-slate-500 mb-3">Formato CSV: page,primary,secondary,others (others separado por |).</p>
        <input type="file" accept=".csv,text/csv" onChange={handleUpload} className="mb-4" />
        <div className="rounded-xl border p-3 text-sm flex items-center gap-2"><Table2 size={16} /> Registros cargados: <strong>{uploadedKeywords.length}</strong></div>
      </section>
    </div>
  );
};

export default UnifiedClusterWorkflowPage;

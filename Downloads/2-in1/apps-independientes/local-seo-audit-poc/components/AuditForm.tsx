"use client";

import { FormEvent, useMemo, useState } from "react";

type ApiResponse = {
  auditId: string;
  generatedAt: string;
  dataPolicy: string;
  report: {
    summary: {
      status: string;
      topProblems: string[];
      topOpportunities: string[];
      globalPriority: string;
    };
    scoring: Array<{ label: string; score: number; benchmark: number; gap: number }>;
    competitors: Array<{ listing: { businessName: string; primaryCategory: string; rating: number; reviewCount: number }; classification: string }>;
    findings: {
      observedFacts: string[];
      calculatedComparisons: string[];
      reasonedInferences: string[];
    };
    actionPlan: {
      quickWins: Array<{ action: string; priority: string; confidence: number }>;
      midTerm: Array<{ action: string; priority: string; confidence: number }>;
      strategic: Array<{ action: string; priority: string; confidence: number }>;
    };
    technicalReport: string;
    commercialReport: string;
  };
};

type CrawlPoint = { t: string; discovered: number; clustered: number; unclustered: number };
type UserClusterRule = { id: string; clusterName: string; match: string };
type UrlClusterResult = { url: string; level: number; cluster: string | null; source: "auto" | "user" | "none" };

const defaultForm = {
  businessName: "Clínica Dental Centro Sonrisa",
  website: "https://centrosonrisa.example",
  primaryKeyword: "dentista madrid centro",
  secondaryKeywords: "implantes madrid,ortodoncia madrid",
  location: "Madrid centro",
  radiusKm: 5,
  category: "Clínica dental",
  sector: "clínicas"
};

const crawlUrls = [
  "/",
  "/blog",
  "/blog/seo-local",
  "/blog/seo-local/checklist",
  "/servicios",
  "/servicios/ortodoncia",
  "/servicios/implantes",
  "/equipo",
  "/contacto",
  "/landing-verano"
];

const extractLevel = (url: string) => {
  if (url === "/") return 0;
  return url.split("/").filter(Boolean).length;
};

const inferAutoCluster = (url: string): string | null => {
  const parts = url.split("/").filter(Boolean);
  if (parts.length <= 1) return null;
  return parts[0];
};

export function AuditForm() {
  const [form, setForm] = useState(defaultForm);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [crawlHistory, setCrawlHistory] = useState<CrawlPoint[]>([]);
  const [crawlRunning, setCrawlRunning] = useState(false);
  const [urlClusterResults, setUrlClusterResults] = useState<UrlClusterResult[]>([]);
  const [userRules, setUserRules] = useState<UserClusterRule[]>([{ id: crypto.randomUUID(), clusterName: "comercial", match: "servicios" }]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          secondaryKeywords: form.secondaryKeywords
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
        })
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || "No se pudo generar la auditoría");
      }

      setResult((await response.json()) as ApiResponse);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  const runCrawl = async () => {
    setCrawlRunning(true);
    setCrawlHistory([]);

    const nextResults: UrlClusterResult[] = [];

    for (let i = 0; i < crawlUrls.length; i += 1) {
      const currentUrl = crawlUrls[i];
      const level = extractLevel(currentUrl);
      const userRule = userRules.find((rule) => rule.clusterName.trim() && rule.match.trim() && currentUrl.includes(rule.match.trim()));
      const auto = inferAutoCluster(currentUrl);
      const cluster = userRule?.clusterName || auto;

      nextResults.push({
        url: currentUrl,
        level,
        cluster: cluster ?? null,
        source: userRule ? "user" : auto ? "auto" : "none"
      });

      const clusteredCount = nextResults.filter((item) => item.cluster).length;
      setCrawlHistory((prev) => [
        ...prev,
        {
          t: `T${i + 1}`,
          discovered: nextResults.length,
          clustered: clusteredCount,
          unclustered: nextResults.length - clusteredCount
        }
      ]);

      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    setUrlClusterResults(nextResults);
    setCrawlRunning(false);
  };

  const inputClass = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm";
  const planSections: Array<{
    label: string;
    actions: Array<{ action: string; priority: string; confidence: number }>;
  }> = result
    ? [
        { label: "7 días", actions: result.report.actionPlan.quickWins },
        { label: "30 días", actions: result.report.actionPlan.midTerm },
        { label: "90 días", actions: result.report.actionPlan.strategic }
      ]
    : [];

  const linePath = useMemo(() => {
    if (crawlHistory.length < 2) return "";
    const maxY = Math.max(...crawlHistory.map((point) => point.clustered), 1);
    return crawlHistory
      .map((point, idx) => {
        const x = (idx / (crawlHistory.length - 1)) * 100;
        const y = 100 - (point.clustered / maxY) * 100;
        return `${idx === 0 ? "M" : "L"}${x},${y}`;
      })
      .join(" ");
  }, [crawlHistory]);

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2">
        <label className="text-sm font-medium text-slate-700 md:col-span-2">Negocio<input className={inputClass} value={form.businessName} onChange={(event) => setForm({ ...form, businessName: event.target.value })} /></label>
        <label className="text-sm font-medium text-slate-700">Keyword principal<input className={inputClass} value={form.primaryKeyword} onChange={(event) => setForm({ ...form, primaryKeyword: event.target.value })} /></label>
        <label className="text-sm font-medium text-slate-700">Ubicación<input className={inputClass} value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></label>
        <label className="text-sm font-medium text-slate-700">Web<input className={inputClass} value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} /></label>
        <label className="text-sm font-medium text-slate-700">Categoría<input className={inputClass} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></label>
        <label className="text-sm font-medium text-slate-700 md:col-span-2">Keywords secundarias (coma separadas)<input className={inputClass} value={form.secondaryKeywords} onChange={(event) => setForm({ ...form, secondaryKeywords: event.target.value })} /></label>

        <button type="submit" className="md:col-span-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60" disabled={loading}>
          {loading ? "Generando auditoría..." : "Generar auditoría puntual"}
        </button>
        {error ? <p className="md:col-span-2 text-sm text-red-600">{error}</p> : null}
      </form>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-900">Clustering por niveles del sitio</h2>
          <button type="button" onClick={runCrawl} disabled={crawlRunning} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60">
            {crawlRunning ? "Rastreando..." : "Iniciar rastreo manual"}
          </button>
        </div>

        <div className="rounded border border-slate-200 p-3">
          <h3 className="mb-2 text-sm font-semibold">Reglas de cluster del usuario (infinitas)</h3>
          <div className="space-y-2">
            {userRules.map((rule) => (
              <div key={rule.id} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                <input className={inputClass} placeholder="Nombre de cluster" value={rule.clusterName} onChange={(event) => setUserRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, clusterName: event.target.value } : item))} />
                <input className={inputClass} placeholder="Regla contains (ej: blog)" value={rule.match} onChange={(event) => setUserRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, match: event.target.value } : item))} />
                <button type="button" className="rounded border border-slate-300 px-3 text-sm" onClick={() => setUserRules((prev) => prev.filter((item) => item.id !== rule.id))}>Eliminar</button>
              </div>
            ))}
          </div>
          <button type="button" className="mt-3 rounded border border-slate-300 px-3 py-1 text-sm" onClick={() => setUserRules((prev) => [...prev, { id: crypto.randomUUID(), clusterName: "", match: "" }])}>Añadir regla</button>
        </div>

        <article>
          <h3 className="font-semibold">Evolución temporal (URLs clusterizadas)</h3>
          <svg viewBox="0 0 100 100" className="mt-2 h-40 w-full rounded border border-slate-200 bg-slate-50">
            <path d="M0,100 L100,100" stroke="#cbd5e1" strokeWidth="1" fill="none" />
            {linePath ? <path d={linePath} stroke="#4f46e5" strokeWidth="2" fill="none" /> : null}
          </svg>
          <p className="mt-1 text-xs text-slate-500">La línea muestra cómo sube el número de URLs clusterizadas durante el rastreo.</p>
        </article>

        <article>
          <h3 className="font-semibold">Resultado URL → cluster</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {urlClusterResults.length === 0 ? <li className="text-slate-500">Sin rastreo ejecutado todavía.</li> : null}
            {urlClusterResults.map((item) => (
              <li key={item.url} className="rounded border border-slate-200 p-2">
                <p className="font-medium">{item.url} · nivel {item.level}</p>
                <p>
                  Cluster: {item.cluster ?? "Sin cluster (URL de raíz sin subpágina anidada)"} · origen {item.source}
                </p>
              </li>
            ))}
          </ul>
        </article>
      </section>

      {result ? (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <header><p className="text-xs uppercase tracking-wide text-slate-500">Audit ID {result.auditId}</p><h2 className="text-xl font-semibold text-slate-900">Resumen ejecutivo ({result.report.summary.status})</h2></header>
          <article><h3 className="font-semibold">Plan priorizado</h3><div className="grid gap-4 md:grid-cols-3">{planSections.map((section) => (<div key={section.label} className="rounded border border-slate-200 p-3 text-sm"><p className="mb-2 font-medium">{section.label}</p><ul className="space-y-2">{section.actions.map((item) => (<li key={item.action}>{item.priority}: {item.action} ({Math.round(item.confidence * 100)}% confianza)</li>))}</ul></div>))}</div></article>
        </section>
      ) : null}
    </div>
  );
}

"use client";

import { FormEvent, useState } from "react";

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

export function AuditForm() {
  const [form, setForm] = useState(defaultForm);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2">
        <label className="text-sm font-medium text-slate-700 md:col-span-2">
          Negocio
          <input className={inputClass} value={form.businessName} onChange={(event) => setForm({ ...form, businessName: event.target.value })} />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Keyword principal
          <input className={inputClass} value={form.primaryKeyword} onChange={(event) => setForm({ ...form, primaryKeyword: event.target.value })} />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Ubicación
          <input className={inputClass} value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Web
          <input className={inputClass} value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Categoría
          <input className={inputClass} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />
        </label>
        <label className="text-sm font-medium text-slate-700 md:col-span-2">
          Keywords secundarias (coma separadas)
          <input className={inputClass} value={form.secondaryKeywords} onChange={(event) => setForm({ ...form, secondaryKeywords: event.target.value })} />
        </label>

        <button
          type="submit"
          className="md:col-span-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
          disabled={loading}
        >
          {loading ? "Generando auditoría..." : "Generar auditoría puntual"}
        </button>
        {error ? <p className="md:col-span-2 text-sm text-red-600">{error}</p> : null}
      </form>

      {result ? (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <header>
            <p className="text-xs uppercase tracking-wide text-slate-500">Audit ID {result.auditId}</p>
            <h2 className="text-xl font-semibold text-slate-900">Resumen ejecutivo ({result.report.summary.status})</h2>
            <p className="text-sm text-slate-600">{result.report.summary.globalPriority}</p>
            <p className="mt-1 text-xs text-slate-500">{result.dataPolicy}</p>
          </header>

          <div className="grid gap-4 md:grid-cols-3">
            <article>
              <h3 className="font-semibold">Problemas principales</h3>
              <ul className="list-disc pl-5 text-sm text-slate-700">
                {result.report.summary.topProblems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
            <article>
              <h3 className="font-semibold">Oportunidades principales</h3>
              <ul className="list-disc pl-5 text-sm text-slate-700">
                {result.report.summary.topOpportunities.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
            <article>
              <h3 className="font-semibold">Competidores detectados</h3>
              <ul className="space-y-2 text-sm text-slate-700">
                {result.report.competitors.map((item) => (
                  <li key={item.listing.businessName}>
                    <span className="font-medium">{item.listing.businessName}</span> · {item.classification} · ⭐ {item.listing.rating} ({item.listing.reviewCount})
                  </li>
                ))}
              </ul>
            </article>
          </div>

          <article>
            <h3 className="font-semibold">Scoring por bloques</h3>
            <ul className="mt-2 grid gap-2 md:grid-cols-2">
              {result.report.scoring.map((item) => (
                <li key={item.label} className="rounded border border-slate-200 p-2 text-sm">
                  <p className="font-medium">{item.label}</p>
                  <p>
                    Score {item.score} / Benchmark {item.benchmark} / Gap {item.gap}
                  </p>
                </li>
              ))}
            </ul>
          </article>

          <article>
            <h3 className="font-semibold">Plan priorizado</h3>
            <div className="grid gap-4 md:grid-cols-3">
              {planSections.map((section) => (
                <div key={section.label} className="rounded border border-slate-200 p-3 text-sm">
                  <p className="mb-2 font-medium">{section.label}</p>
                  <ul className="space-y-2">
                    {section.actions.map((item) => (
                      <li key={item.action}>{item.priority}: {item.action} ({Math.round(item.confidence * 100)}% confianza)</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </article>
        </section>
      ) : null}
    </div>
  );
}

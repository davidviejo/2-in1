import { AuditForm } from "@/components/AuditForm";

export default function HomePage() {
  return (
    <main className="mx-auto min-h-screen max-w-6xl bg-slate-50 px-4 py-8 md:px-8">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wide text-slate-500">Aplicación independiente / sandbox</p>
        <h1 className="text-3xl font-bold text-slate-900">Herramienta de auditoría puntual de SEO local en Google Maps asistida por IA</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-700">
          PoC autónoma enfocada en consultores/agencias. Flujo: briefing → clasificación competitiva → scoring → evidencia → narrativa IA → informe accionable.
        </p>
      </header>
      <AuditForm />
    </main>
  );
}

import React from 'react';

const pasosMetodologia = [
  'Primero es la auditoria.',
  'Luego los puntos de control.',
  'Luego el desglose web',
  'Luego el kws clusterin',
  'Luego el avance.',
];

const MetodologiaPage: React.FC = () => (
  <section className="mx-auto max-w-3xl px-4 py-10">
    <h1 className="text-2xl font-semibold text-foreground">Metodología</h1>
    <p className="mt-2 text-sm text-muted-foreground">
      Esta página es únicamente informativa.
    </p>

    <ol className="mt-6 space-y-3">
      {pasosMetodologia.map((paso) => (
        <li key={paso} className="rounded-lg border border-border bg-card px-4 py-3 text-card-foreground">
          {paso}
        </li>
      ))}
    </ol>
  </section>
);

export default MetodologiaPage;

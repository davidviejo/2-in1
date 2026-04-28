'use client';

import { ReactNode } from 'react';

type Option = { label: string; value: string };

type SharedFiltersProps = {
  from: string;
  to: string;
  model: string;
  tag: string;
  country: string;
  language: string;
  search: string;
  onChange: (key: string, value: string) => void;
  extra?: ReactNode;
  showDateRange?: boolean;
};

const MODEL_OPTIONS: Option[] = [
  { label: 'All models', value: '' },
  { label: 'GPT-4o', value: 'gpt-4o' },
  { label: 'GPT-4.1', value: 'gpt-4.1' },
  { label: 'Gemini 1.5 Pro', value: 'gemini-1.5-pro' },
  { label: 'Claude 3.5 Sonnet', value: 'claude-3.5-sonnet' }
];

export function SharedReportingFilters({ from, to, model, tag, country, language, search, onChange, extra, showDateRange = true }: SharedFiltersProps) {
  return (
    <section className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs md:grid-cols-2 xl:grid-cols-7">
      <input className="rounded border border-slate-300 px-2 py-1" value={search} onChange={(event) => onChange('q', event.target.value)} placeholder="Search" />
      {showDateRange ? <input className="rounded border border-slate-300 px-2 py-1" value={from} onChange={(event) => onChange('from', event.target.value)} type="date" /> : null}
      {showDateRange ? <input className="rounded border border-slate-300 px-2 py-1" value={to} onChange={(event) => onChange('to', event.target.value)} type="date" /> : null}
      <select className="rounded border border-slate-300 px-2 py-1" value={model} onChange={(event) => onChange('model', event.target.value)}>
        {MODEL_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <input className="rounded border border-slate-300 px-2 py-1" value={tag} onChange={(event) => onChange('tag', event.target.value)} placeholder="Tag" />
      <input className="rounded border border-slate-300 px-2 py-1" value={country} onChange={(event) => onChange('country', event.target.value)} placeholder="Country" maxLength={2} />
      <input className="rounded border border-slate-300 px-2 py-1" value={language} onChange={(event) => onChange('language', event.target.value)} placeholder="Language" />
      {extra}
    </section>
  );
}

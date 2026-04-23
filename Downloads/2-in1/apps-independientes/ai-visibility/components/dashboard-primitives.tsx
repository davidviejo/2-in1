import { ReactNode } from 'react';

type PageHeaderProps = {
  title: string;
  description: string;
  actions?: ReactNode;
};

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold leading-tight text-slate-900">{title}</h1>
        <p className="max-w-3xl text-sm leading-5 text-slate-600">{description}</p>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

type FilterBarProps = {
  children: ReactNode;
};

export function FilterBar({ children }: FilterBarProps) {
  return (
    <section
      aria-label="Data filters"
      className="flex flex-col gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 md:flex-row md:items-center"
    >
      {children}
    </section>
  );
}

type KpiCardProps = {
  label: string;
  value: string;
  trend?: string;
};

export function KpiCard({ label, value, trend }: KpiCardProps) {
  return (
    <article className="rounded-md border border-slate-200 bg-white p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold leading-none text-slate-900">{value}</p>
      {trend ? <p className="mt-2 text-xs text-slate-600">{trend}</p> : null}
    </article>
  );
}

type SectionCardProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

export function SectionCard({ title, description, children }: SectionCardProps) {
  return (
    <section className="rounded-md border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {description ? <p className="mt-1 text-xs text-slate-600">{description}</p> : null}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

type DataTableShellProps = {
  columns: string[];
  children?: ReactNode;
};

export function DataTableShell({ columns, children }: DataTableShellProps) {
  return (
    <div className="overflow-hidden rounded-md border border-slate-200">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((column) => (
                <th className="px-3 py-2 font-medium text-slate-700" key={column} scope="col">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}

type EmptyStateProps = {
  title: string;
  description: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
    </div>
  );
}

type LoadingStateProps = {
  label?: string;
};

export function LoadingState({ label = 'Loading data…' }: LoadingStateProps) {
  return (
    <div aria-busy="true" className="rounded-md border border-slate-200 bg-slate-50 px-4 py-6">
      <p className="text-sm text-slate-700">{label}</p>
      <div className="mt-3 h-2 w-full animate-pulse rounded bg-slate-200" />
    </div>
  );
}

type ErrorStateProps = {
  title: string;
  description: string;
};

export function ErrorState({ title, description }: ErrorStateProps) {
  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-4 py-4 text-sm">
      <h3 className="font-semibold text-red-900">{title}</h3>
      <p className="mt-1 text-red-800">{description}</p>
    </div>
  );
}

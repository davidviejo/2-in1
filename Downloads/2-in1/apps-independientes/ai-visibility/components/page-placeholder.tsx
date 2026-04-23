import {
  DataTableShell,
  EmptyState,
  ErrorState,
  FilterBar,
  KpiCard,
  LoadingState,
  PageHeader,
  SectionCard
} from '@/components/dashboard-primitives';

type PagePlaceholderProps = {
  title: string;
  description: string;
};

export function PagePlaceholder({ title, description }: PagePlaceholderProps) {
  return (
    <div className="space-y-4">
      <PageHeader
        title={title}
        description={description}
        actions={
          <>
            <button
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
              type="button"
            >
              Export
            </button>
            <button
              className="rounded-md border border-slate-900 bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
              type="button"
            >
              New report
            </button>
          </>
        }
      />

      <FilterBar>
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-medium text-slate-700" htmlFor={`${title}-query`}>
          Search
          <input
            className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-500"
            id={`${title}-query`}
            placeholder="Filter by keyword"
            type="search"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-slate-700" htmlFor={`${title}-period`}>
          Time range
          <select
            className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-500"
            defaultValue="30"
            id={`${title}-period`}
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
        </label>
      </FilterBar>

      <section aria-label="KPI summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Coverage" value="72%" trend="+3.8 pts vs last period" />
        <KpiCard label="Citations" value="194" trend="+12 this week" />
        <KpiCard label="Avg. rank" value="#4.1" trend="Improved from #5.0" />
        <KpiCard label="Tracked entities" value="38" trend="2 new entities" />
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Recent records" description="Shared data table shell for route placeholders.">
          <DataTableShell columns={["Prompt", "Model", "Status", "Updated"]}>
            <tr className="border-t border-slate-100">
              <td className="px-3 py-2 text-slate-700">Brand visibility baseline</td>
              <td className="px-3 py-2 text-slate-700">GPT-4.1</td>
              <td className="px-3 py-2 text-slate-700">Ready</td>
              <td className="px-3 py-2 text-slate-700">2h ago</td>
            </tr>
            <tr className="border-t border-slate-100">
              <td className="px-3 py-2 text-slate-700">Competitor comparison</td>
              <td className="px-3 py-2 text-slate-700">Claude</td>
              <td className="px-3 py-2 text-slate-700">Queued</td>
              <td className="px-3 py-2 text-slate-700">9m ago</td>
            </tr>
          </DataTableShell>
        </SectionCard>

        <div className="space-y-4">
          <SectionCard title="Empty state">
            <EmptyState title="No saved views yet" description="Create a reusable filter preset to speed up analysis." />
          </SectionCard>

          <SectionCard title="Loading + error states">
            <div className="space-y-3">
              <LoadingState label="Hydrating dashboard metrics…" />
              <ErrorState
                title="Could not refresh source sync"
                description="Retry from the integration panel or check service health logs."
              />
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

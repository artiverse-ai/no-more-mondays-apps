// Shared skeletons for every /dashboards/* route. Rendered by the
// route-segment `loading.tsx` files and inside `<Suspense fallback>`
// boundaries where a slow BigQuery query would otherwise leave the page
// frozen.
//
// Each section is opt-in via a config so the same skeleton matches the
// rough shape of whichever dashboard it's standing in for — hero strip,
// filter bar, KPI row, chart card, leaderboard table.

type SectionKey =
  | "hero"
  | "filterBar"
  | "kpiStrip"
  | "chart"
  | "table"
  | "funnel";

export function DashboardSkeleton({
  sections = ["hero", "filterBar", "kpiStrip", "chart", "table"],
  /** How many KPI cells the skeleton shows in the strip. Tune per dashboard. */
  kpis = 6,
  /** How many table rows to render. */
  rows = 8,
}: {
  sections?: SectionKey[];
  kpis?: number;
  rows?: number;
}) {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      {sections.map((s) => {
        switch (s) {
          case "hero":
            return <HeroSkeleton key={s} />;
          case "filterBar":
            return <FilterBarSkeleton key={s} />;
          case "kpiStrip":
            return <KpiStripSkeleton key={s} count={kpis} />;
          case "chart":
            return <ChartSkeleton key={s} />;
          case "funnel":
            return <FunnelSkeleton key={s} />;
          case "table":
            return <TableSkeleton key={s} rows={rows} />;
        }
      })}
    </div>
  );
}

function HeroSkeleton() {
  return (
    <div className="animate-pulse space-y-3 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="h-3 w-32 rounded bg-muted/40" />
          <div className="h-7 w-72 rounded bg-muted/50" />
          <div className="h-3 w-96 max-w-full rounded bg-muted/30" />
        </div>
        <div className="h-9 w-56 rounded-xl bg-muted/40" />
      </div>
    </div>
  );
}

function FilterBarSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="h-7 w-44 rounded-xl bg-muted/40" />
        <div className="h-7 w-32 rounded-xl bg-muted/40" />
        <div className="h-7 w-32 rounded-xl bg-muted/40" />
        <div className="h-7 w-32 rounded-xl bg-muted/40" />
        <div className="h-7 w-32 rounded-xl bg-muted/40" />
        <div className="ml-auto h-7 w-20 rounded-xl bg-muted/30" />
      </div>
    </div>
  );
}

function KpiStripSkeleton({ count }: { count: number }) {
  return (
    <div className="grid animate-pulse grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]"
        >
          <div className="h-2.5 w-20 rounded bg-muted/40" />
          <div className="mt-3 h-7 w-16 rounded bg-muted/50" />
          <div className="mt-2 h-2 w-24 rounded bg-muted/30" />
        </div>
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="mb-4 flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-3 w-32 rounded bg-muted/40" />
          <div className="h-4 w-48 rounded bg-muted/50" />
        </div>
        <div className="h-7 w-40 rounded-xl bg-muted/30" />
      </div>
      <div className="flex h-56 items-end gap-2">
        {Array.from({ length: 18 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 rounded-t bg-muted/40"
            style={{ height: `${30 + ((i * 13) % 70)}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function FunnelSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="mb-3 h-4 w-48 rounded bg-muted/50" />
      <div className="space-y-2">
        {[100, 84, 62, 38, 22, 12].map((w, i) => (
          <div
            key={i}
            className="h-7 rounded-md bg-muted/40"
            style={{ width: `${w}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function TableSkeleton({ rows }: { rows: number }) {
  return (
    <div className="animate-pulse rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between border-b border-border bg-muted/20 px-4 py-3">
        <div className="h-4 w-40 rounded bg-muted/40" />
        <div className="h-3 w-20 rounded bg-muted/30" />
      </div>
      <ul>
        {Array.from({ length: rows }).map((_, i) => (
          <li
            key={i}
            className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr] items-center gap-3 border-b border-border/60 px-4 py-3 last:border-b-0"
          >
            <div className="h-3 w-24 rounded bg-muted/40" />
            <div className="h-3 w-20 rounded bg-muted/30" />
            <div className="h-3 w-16 rounded bg-muted/30" />
            <div className="h-3 w-12 rounded bg-muted/30" />
            <div className="h-3 w-14 rounded bg-muted/30" />
            <div className="h-3 w-10 rounded bg-muted/30" />
          </li>
        ))}
      </ul>
    </div>
  );
}

import Link from "next/link";

import { getCurrentUser } from "@/lib/auth";
import { getDevMode } from "@/lib/dev-mode";
import {
  aggregateWebinarByGran,
  computeKpis,
  filterWebinars,
  funnelStages,
  getWebinars,
  sortWebinars,
} from "@/lib/webinar";
import { DataFreshness } from "@/components/DataFreshness";
import { DealsChart } from "@/components/webinar/DealsChart";
import { DevModeToggle } from "@/components/DevModeToggle";
import { FunnelChart } from "@/components/webinar/FunnelChart";
import { AllMetrics, HeroKPIs } from "@/components/webinar/HeadlineKPIs";
import { RoasChart } from "@/components/webinar/RoasChart";
import { SpendCashChart } from "@/components/webinar/SpendCashChart";
import { WebinarFilters } from "@/components/webinar/WebinarFilters";
import { WebinarTable } from "@/components/webinar/WebinarTable";
import { fmt } from "@/components/webinar/format";
import { GranularityPicker } from "@/components/ui/granularity-picker";
import { ViewTabs } from "@/components/ui/view-tabs";
import { parseViewTab } from "@/lib/view-tabs";
import { GRANS_WEBINAR, parseGranularity } from "@/lib/granularity";

// Per-webinar table first (default) — Overview is secondary. The team
// reads the table most often when they open the dashboard cold.
const VIEW_OPTIONS = [
  { key: "table", label: "Per-webinar table" },
  { key: "overview", label: "Overview" },
];

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Webinar Performance · No More Mondays",
};

const pickStr = (v: string | string[] | undefined, fallback = ""): string =>
  typeof v === "string" ? v : fallback;

export default async function WebinarDashboardPage(
  props: PageProps<"/dashboards/webinar">,
) {
  const sp = await props.searchParams;
  const day = pickStr(sp.day);
  const era = pickStr(sp.era);
  const from = pickStr(sp.from);
  const to = pickStr(sp.to);
  const sort = pickStr(sp.sort, "webinar_date");
  const dir: "asc" | "desc" = pickStr(sp.dir, "desc") === "asc" ? "asc" : "desc";
  const gran = parseGranularity(sp.gran, GRANS_WEBINAR, "webinar");
  const view = parseViewTab(sp.view, VIEW_OPTIONS, "table");

  const [all, user, devMode] = await Promise.all([
    getWebinars(),
    getCurrentUser(),
    getDevMode(),
  ]);

  const days = [...new Set(all.map((w) => w.webinar_day))].filter(Boolean);
  const eras = [...new Set(all.map((w) => w.data_era))].filter(Boolean);

  const filtered = filterWebinars(all, { day, era, from, to });
  const sorted = sortWebinars(filtered, sort, dir);
  const kpis = computeKpis(filtered);

  const ascByDate = [...filtered].sort((a, b) =>
    a.webinar_date.localeCompare(b.webinar_date),
  );
  const latest = ascByDate[ascByDate.length - 1] ?? null;

  // Roll the filtered webinars up to the chosen time-axis granularity.
  // For gran === "webinar", this is one point per event (current default).
  const chartPoints = aggregateWebinarByGran(filtered, gran);
  const granLabel: Record<typeof gran, string> = {
    webinar: "per webinar",
    week: "by Sunday-anchored week",
    month: "by month",
    year: "by year",
    day: "per day",
  };

  // Latest dbt freshness across all webinars — drives the auto-refreshing
  // `<DataFreshness>` indicator in the hero.
  const updatedAt =
    all
      .map((w) => w.dbt_updated_at)
      .filter((s): s is string => !!s && !isNaN(new Date(s).getTime()))
      .sort()
      .at(-1) ?? null;

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-3 sm:p-4 md:p-8 lg:p-10">
      {/* Hero */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-8">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
            No More Mondays &middot; Analytics
          </p>
          <h1 className="font-heading text-4xl font-semibold tracking-tight md:text-5xl">
            Webinar Performance
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            End-to-end funnel — spend, registrations, attendance, calls,
            revenue. Live from{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
              dbt_tuddin.mart_webinar_events
            </code>
            .
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <DataFreshness asOf={updatedAt} />
          <p className="text-xs text-muted-foreground">
            {all.length} webinar{all.length === 1 ? "" : "s"}
          </p>
          <div className="flex items-center gap-2">
            <a
              href="https://www.notion.so/nomoremondays/SOP-Webinar-Performance-Dashboard-3629b9a6796a8007a796fe291db98bad"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-7 items-center rounded-md border border-alert-blue/40 bg-alert-blue/10 px-2.5 text-[11px] font-medium uppercase tracking-[0.12em] text-alert-blue shadow-sm transition-colors hover:bg-alert-blue/15"
              title="Open the Webinar Performance SOP in Notion"
            >
              📖 SOP
            </a>
            {user?.isAdmin ? <DevModeToggle current={devMode} /> : null}
            {user?.isAdmin ? (
              <Link
                href="/admin"
                className="inline-flex h-7 items-center rounded-md border border-border bg-card px-2.5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground shadow-sm transition-colors hover:border-accent hover:text-accent"
                style={{ transitionTimingFunction: "var(--ease-out)" }}
              >
                Admin
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      {/* Executive view hides developer-facing methodology notes; flip
          devMode in the breadcrumb to see them. */}
      {devMode ? (
        <p className="rounded-xl border border-alert-orange/30 bg-alert-orange/5 px-4 py-2.5 text-[12px] leading-relaxed text-foreground">
          <strong className="font-semibold text-alert-orange">Dev note:</strong>{" "}
          <code className="rounded bg-alert-orange/10 px-1 py-0.5 font-mono">
            shows
          </code>{" "}
          excludes Setter DQs (PR #43 fix). Historical values may be smaller
          than pre-2026-04-19 &ldquo;Calls Held&rdquo;. Hover any{" "}
          <code className="rounded bg-muted/60 px-1 py-0.5 font-mono">i</code>{" "}
          for the formula.
        </p>
      ) : null}

      {/* View tabs — sit above filters so users see what they're toggling */}
      <ViewTabs
        pathname="/dashboards/webinar"
        value={view}
        options={VIEW_OPTIONS}
      />

      {/* Filters — always visible regardless of tab so they persist on switch */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <WebinarFilters
          days={days}
          eras={eras}
          day={day}
          era={era}
          from={from}
          to={to}
        />
      </section>

      {view === "overview" ? (
        <>
          {/* Hero KPIs — 4 big primary metrics */}
          <HeroKPIs kpis={kpis} devMode={devMode} />

          {/* Collapsible "All metrics" with the rest */}
          <AllMetrics kpis={kpis} rowCount={filtered.length} devMode={devMode} />

          {/* Charts */}
          {filtered.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
              No webinars match these filters.
            </p>
          ) : (
            <section className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Trends
                  </p>
                  <h2 className="font-heading text-2xl font-semibold tracking-tight">
                    Over time
                  </h2>
                </div>
                <GranularityPicker
                  pathname="/dashboards/webinar"
                  value={gran}
                  options={GRANS_WEBINAR}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <SpendCashChart points={chartPoints} subtitle={granLabel[gran]} />
                <DealsChart
                  points={chartPoints}
                  title={`Deals closed ${granLabel[gran]}`}
                />
                <RoasChart points={chartPoints} />
                {latest ? (
                  <FunnelChart
                    stages={funnelStages(latest)}
                    title="Funnel — most recent webinar"
                    subtitle={`${fmt.date(latest.webinar_date)} · ${latest.webinar_day}`}
                    height="h-64"
                  />
                ) : null}
              </div>
            </section>
          )}
        </>
      ) : (
        <WebinarTable
          rows={sorted}
          sort={sort}
          dir={dir}
          total={all.length}
          devMode={devMode}
        />
      )}
    </main>
  );
}

import Link from "next/link";

import { getCurrentUser } from "@/lib/auth";
import { getDevMode } from "@/lib/dev-mode";
import {
  computeFunnelCounts,
  computeKpis,
  deriveFilterOptions,
  getCalls,
  getCallsTableFreshness,
  rollupByCloser,
  type CallRow,
  type OccFuc,
} from "@/lib/calls";
import {
  DATE_RANGE_OPTIONS,
  isDateRangeKey,
  priorEqualPeriod,
  resolveDateRange,
  type DateRangeKey,
} from "@/lib/period";
import { CallsDrillThrough } from "@/components/sales/CallsDrillThrough";
import { CallsFilterRow } from "@/components/sales/CallsFilterRow";
import { CloserLeaderboard } from "@/components/sales/CloserLeaderboard";
import { DataFreshness } from "@/components/DataFreshness";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DevModeToggle } from "@/components/DevModeToggle";
import { Kpi } from "@/components/webinar/Kpi";
import { ViewTabs } from "@/components/ui/view-tabs";
import { parseViewTab } from "@/lib/view-tabs";
import { cn } from "@/lib/utils";
import { fmt } from "@/components/webinar/format";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sales Performance · No More Mondays",
};

const PATHNAME = "/dashboards/sales";

const VIEW_OPTIONS = [
  { key: "overview", label: "Overview" },
  { key: "detail", label: "Detail" },
];

const pickStr = (v: string | string[] | undefined, fallback = ""): string =>
  typeof v === "string" ? v : fallback;

const pickOccFuc = (v: string | string[] | undefined): OccFuc | undefined => {
  const s = pickStr(v);
  return s === "OCC" || s === "FUC" ? s : undefined;
};

export default async function SalesDashboardPage(
  props: PageProps<"/dashboards/sales">,
) {
  const sp = await props.searchParams;

  // -----------------------------------------------------------------
  // Resolve URL state.
  // -----------------------------------------------------------------
  const rawPeriod = pickStr(sp.period, "this-week");
  const periodKey: DateRangeKey = isDateRangeKey(rawPeriod)
    ? rawPeriod
    : "this-week";
  const resolved = resolveDateRange({
    period: periodKey,
    from: pickStr(sp.from),
    to: pickStr(sp.to),
  });
  const prior = priorEqualPeriod(resolved);

  const source = pickStr(sp.source);
  const closer = pickStr(sp.closer);
  const setter = pickStr(sp.setter);
  const triage = pickStr(sp.triage);
  const callOutcome = pickStr(sp.callOutcome);
  const occFucStr = pickStr(sp.occFuc);
  const occFuc = pickOccFuc(sp.occFuc);
  const emailLike = pickStr(sp.email);
  const view = parseViewTab(sp.view, VIEW_OPTIONS, "overview");
  const sort = pickStr(sp.sort, "cash");
  const dir: "asc" | "desc" = pickStr(sp.dir, "desc") === "asc" ? "asc" : "desc";
  const page = Math.max(1, parseInt(pickStr(sp.page, "1"), 10) || 1);

  // -----------------------------------------------------------------
  // Single canonical query per page-load (current + prior periods in
  // parallel for Δ-vs-prior computation).
  // -----------------------------------------------------------------
  const [allCurrent, allPrior, updatedAt, user, devMode] = await Promise.all([
    getCalls({ from: resolved.from, to: resolved.to }),
    getCalls({ from: prior.from, to: prior.to }),
    getCallsTableFreshness(),
    getCurrentUser(),
    getDevMode(),
  ]);

  // Cross-filter options derived from UNFILTERED rows so chips don't shrink.
  const options = deriveFilterOptions(allCurrent);

  // Apply cross-filters in JS — fast on the already-loaded array.
  const filtered = applyCrossFilters(allCurrent, {
    source,
    closer,
    setter,
    triage,
    callOutcome,
    occFuc,
    emailLike,
  });
  const filteredPrior = applyCrossFilters(allPrior, {
    source,
    closer,
    setter,
    triage,
    callOutcome,
    occFuc,
    emailLike,
  });

  const kpis = computeKpis(filtered);
  const kpisPrior = computeKpis(filteredPrior);
  const funnel = computeFunnelCounts(filtered);
  const funnelPrior = computeFunnelCounts(filteredPrior);
  const closerRollup = rollupByCloser(filtered);

  const sharedSp = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string" && v) sharedSp.set(k, v);
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-3 sm:p-4 md:p-8 lg:p-10">
      {/* Hero */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
            No More Mondays &middot; Sales
          </p>
          <h1 className="font-heading text-4xl font-semibold tracking-tight md:text-5xl">
            Closer Performance
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Every call from{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
              dbt_tuddin.int_calls_enriched
            </code>{" "}
            with the PR-#43 show-rate fix. Hover any{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono">i</code>{" "}
            for the formula, period, and date dimension.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <DateRangePicker pathname={PATHNAME} resolved={resolved} />
          <DataFreshness asOf={updatedAt} />
          <div className="flex items-center gap-2">
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

      {/* View tabs — always visible regardless of which tab is selected. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ViewTabs
          pathname={PATHNAME}
          value={view}
          options={VIEW_OPTIONS}
        />
        <DateRangeQuickButtons currentKey={periodKey} pathname={PATHNAME} />
      </div>

      {/* Cross-filter row — always visible so users can refine no matter
          which tab they're on. */}
      <CallsFilterRow
        pathname={PATHNAME}
        options={options}
        source={source}
        closer={closer}
        setter={setter}
        triage={triage}
        callOutcome={callOutcome}
        occFuc={occFucStr}
        emailLike={emailLike}
      />

      {view === "overview" ? (
        <OverviewTab
          kpis={kpis}
          kpisPrior={kpisPrior}
          funnel={funnel}
          funnelPrior={funnelPrior}
          devMode={devMode}
        />
      ) : (
        <DetailTab
          closerRollup={closerRollup}
          calls={filtered}
          sort={sort}
          dir={dir}
          page={page}
          searchParams={sharedSp}
        />
      )}
    </main>
  );
}

// =====================================================================
// Tab — Overview
// =====================================================================

function OverviewTab({
  kpis,
  kpisPrior,
  funnel,
  funnelPrior,
  devMode,
}: {
  kpis: ReturnType<typeof computeKpis>;
  kpisPrior: ReturnType<typeof computeKpis>;
  funnel: ReturnType<typeof computeFunnelCounts>;
  funnelPrior: ReturnType<typeof computeFunnelCounts>;
  devMode: boolean;
}) {
  // Δ-vs-prior: simple percentage change. Falls back to null when the
  // prior period has zero of the metric (avoid divide-by-zero +∞).
  const delta = (curr: number | null, prev: number | null): number | null => {
    if (curr == null || prev == null) return null;
    if (prev === 0) return null;
    return (curr - prev) / prev;
  };

  return (
    <section className="space-y-6">
      {/* Headline money KPIs — six big tiles. */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Kpi
          label="Cash"
          metric="total_cash_collected"
          devMode={devMode}
          size="hero"
          value={fmt.money(kpis.cash)}
          delta={delta(kpis.cash, kpisPrior.cash)}
        />
        <Kpi
          label="TCV"
          metric="total_revenue_contracted"
          devMode={devMode}
          size="hero"
          value={fmt.money(kpis.tcv)}
          delta={delta(kpis.tcv, kpisPrior.tcv)}
        />
        <Kpi
          label="AOV"
          metric="aov"
          devMode={devMode}
          size="hero"
          value={fmt.money(kpis.aov)}
          sub="cash / deal"
        />
        <Kpi
          label="ACV"
          metric="acv"
          devMode={devMode}
          size="hero"
          value={fmt.money(kpis.acv)}
          sub="TCV / deal"
        />
        <Kpi
          label="Deals"
          metric="total_deals_closed"
          devMode={devMode}
          size="hero"
          value={fmt.int(funnel.deals)}
          delta={delta(funnel.deals, funnelPrior.deals)}
        />
        <Kpi
          label="OCC %"
          metric="closer_occ_rate"
          devMode={devMode}
          size="hero"
          value={fmt.pct(kpis.occ_rate)}
          sub="OCC deals / all"
        />
      </div>

      {/* Conversion-rate + cycle row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        <Kpi
          label="$/Disposed"
          metric="cash_collected"
          devMode={devMode}
          value={fmt.money(kpis.dollars_per_dispositioned)}
          sub="cash / disposed prospect"
        />
        <Kpi
          label="$/SQ"
          metric="cash_collected"
          devMode={devMode}
          value={fmt.money(kpis.dollars_per_sq)}
          sub="cash / SQ prospect"
        />
        <Kpi
          label="Disp → CQ %"
          metric="show_rate"
          devMode={devMode}
          value={fmt.pct(kpis.dispositioned_to_cq_rate)}
        />
        <Kpi
          label="CQ → Close %"
          metric="close_rate_closer_qualified"
          devMode={devMode}
          value={fmt.pct(kpis.cq_to_close_rate)}
        />
        <Kpi
          label="SQ → Show %"
          metric="show_rate"
          devMode={devMode}
          value={fmt.pct(kpis.sq_to_sq_rate)}
        />
        <Kpi
          label="Med Book → Close"
          metric="median_booking_to_close_occ"
          devMode={devMode}
          value={kpis.median_booking_to_close == null ? "—" : `${Math.round(kpis.median_booking_to_close)}d`}
        />
        <Kpi
          label="Med 1st → Close"
          metric="median_first_call_to_close_fuc"
          devMode={devMode}
          value={kpis.median_first_call_to_close == null ? "—" : `${Math.round(kpis.median_first_call_to_close)}d`}
        />
      </div>

      {/* Funnel-count row (14 cells, Δ vs prior). */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Funnel · COUNT_DISTINCT(prospect_email_lc)
          </span>
          <span className="text-[10px] text-muted-foreground">
            Each number = unique prospects, Δ vs prior equal-length period
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-7">
          <FunnelCell label="Prospects" value={funnel.prospects} delta={delta(funnel.prospects, funnelPrior.prospects)} />
          <FunnelCell label="Pending Disp" value={funnel.pending_dispo} delta={delta(funnel.pending_dispo, funnelPrior.pending_dispo)} />
          <FunnelCell label="Disposed" value={funnel.dispositioned} delta={delta(funnel.dispositioned, funnelPrior.dispositioned)} />
          <FunnelCell label="Setter DQ" value={funnel.setter_dq} delta={delta(funnel.setter_dq, funnelPrior.setter_dq)} tone="orange" />
          <FunnelCell label="Resched" value={funnel.rescheduled} delta={delta(funnel.rescheduled, funnelPrior.rescheduled)} />
          <FunnelCell label="SQ Prospects" value={funnel.prospects_sq} delta={delta(funnel.prospects_sq, funnelPrior.prospects_sq)} />
          <FunnelCell label="No-shows" value={funnel.no_shows} delta={delta(funnel.no_shows, funnelPrior.no_shows)} tone="red" />
          <FunnelCell label="Canceled (pros)" value={funnel.canceled_by_prospect} delta={delta(funnel.canceled_by_prospect, funnelPrior.canceled_by_prospect)} tone="red" />
          <FunnelCell label="Canceled" value={funnel.canceled} delta={delta(funnel.canceled, funnelPrior.canceled)} tone="red" />
          <FunnelCell label="Shows (SQ)" value={funnel.shows_sq} delta={delta(funnel.shows_sq, funnelPrior.shows_sq)} />
          <FunnelCell label="Closer DQ" value={funnel.closer_dq} delta={delta(funnel.closer_dq, funnelPrior.closer_dq)} tone="yellow" />
          <FunnelCell label="Qualified Shows" value={funnel.shows_cq} delta={delta(funnel.shows_cq, funnelPrior.shows_cq)} />
          <FunnelCell label="Deposits" value={funnel.deposits} delta={delta(funnel.deposits, funnelPrior.deposits)} tone="blue" />
          <FunnelCell label="Deals" value={funnel.deals} delta={delta(funnel.deals, funnelPrior.deals)} tone="green" />
        </div>
      </div>
    </section>
  );
}

function FunnelCell({
  label,
  value,
  delta,
  tone,
}: {
  label: string;
  value: number;
  delta: number | null;
  tone?: "green" | "red" | "blue" | "orange" | "yellow";
}) {
  const toneClass: Record<NonNullable<typeof tone>, string> = {
    green: "text-alert-green",
    red: "text-alert-red",
    blue: "text-alert-blue",
    orange: "text-alert-orange",
    yellow: "text-alert-yellow",
  };
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-2.5">
      <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </div>
      <div className={cn("font-heading text-xl font-semibold tabular-nums", tone ? toneClass[tone] : "")}>
        {value.toLocaleString()}
      </div>
      {delta != null && Number.isFinite(delta) ? (
        <div
          className={cn(
            "mt-0.5 text-[10px] font-semibold tabular-nums",
            delta >= 0 ? "text-alert-green" : "text-alert-red",
          )}
        >
          {delta >= 0 ? "↑" : "↓"} {Math.abs(delta * 100).toFixed(delta >= 1 || delta <= -1 ? 0 : 1)}%
        </div>
      ) : (
        <div className="mt-0.5 text-[10px] text-muted-foreground/60">·</div>
      )}
    </div>
  );
}

// =====================================================================
// Tab — Detail
// =====================================================================

function DetailTab({
  closerRollup,
  calls,
  sort,
  dir,
  page,
  searchParams,
}: {
  closerRollup: ReturnType<typeof rollupByCloser>;
  calls: CallRow[];
  sort: string;
  dir: "asc" | "desc";
  page: number;
  searchParams: URLSearchParams;
}) {
  return (
    <section className="space-y-6">
      <CloserLeaderboard
        rows={closerRollup}
        sort={sort}
        dir={dir}
        pathname={PATHNAME}
      />
      <CallsDrillThrough
        rows={calls}
        page={page}
        pathname={PATHNAME}
        searchParams={searchParams}
      />
    </section>
  );
}

// =====================================================================
// Helpers
// =====================================================================

function applyCrossFilters(
  rows: CallRow[],
  f: {
    source: string;
    closer: string;
    setter: string;
    triage: string;
    callOutcome: string;
    occFuc: OccFuc | undefined;
    emailLike: string;
  },
): CallRow[] {
  if (
    !f.source &&
    !f.closer &&
    !f.setter &&
    !f.triage &&
    !f.callOutcome &&
    !f.occFuc &&
    !f.emailLike
  ) {
    return rows;
  }
  const emailLow = f.emailLike?.toLowerCase() ?? "";
  return rows.filter((r) => {
    if (f.source && r.final_marketing_flow !== f.source) return false;
    if (f.closer && r.closer_owner !== f.closer) return false;
    if (f.setter) {
      const s = r.setter_owner ?? r.calendly_setter_name;
      if (s !== f.setter) return false;
    }
    if (f.triage && r.triage_caller !== f.triage) return false;
    if (f.callOutcome && r.call_status_category !== f.callOutcome) return false;
    if (f.occFuc && r.close_type !== f.occFuc) return false;
    if (emailLow) {
      if (!r.prospect_email_lc?.toLowerCase().includes(emailLow)) return false;
    }
    return true;
  });
}

// Lightweight quick-button rail next to ViewTabs. Mirrors what the
// DateRangePicker exposes inside its popover, but reachable in one click.
function DateRangeQuickButtons({
  currentKey,
  pathname,
}: {
  currentKey: DateRangeKey;
  pathname: string;
}) {
  return (
    <div className="hidden flex-wrap gap-1 md:flex">
      {DATE_RANGE_OPTIONS.filter((o) => o.key !== "custom").map((o) => {
        const active = o.key === currentKey;
        return (
          <Link
            key={o.key}
            href={`${pathname}?period=${o.key}`}
            className={cn(
              "rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors",
              active
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card text-muted-foreground hover:border-foreground/40 hover:text-foreground",
            )}
            style={{ transitionTimingFunction: "var(--ease-out)" }}
          >
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}

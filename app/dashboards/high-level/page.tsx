import { getCurrentUser } from "@/lib/auth";
import { getDevMode } from "@/lib/dev-mode";
import {
  aggregateHighLevelByGran,
  computeCeoKpis,
  getHighLevelRange,
  getSalesCyclesRange,
  suggestGranularity,
  type TrendGranularity,
} from "@/lib/highLevel";
import {
  DATE_RANGE_OPTIONS,
  isDateRangeKey,
  resolveDateRange,
  type DateRangeKey,
} from "@/lib/period";
import { cn } from "@/lib/utils";
import { DataFreshness } from "@/components/DataFreshness";
import { DailyTrendChart } from "@/components/highLevel/DailyTrendChart";
import { MarketingKpis } from "@/components/highLevel/MarketingKpis";
import { SalesCycleKpis } from "@/components/highLevel/SalesCycleKpis";
import { SalesKpis } from "@/components/highLevel/SalesKpis";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DevModeToggle } from "@/components/DevModeToggle";
import { GranularityPicker } from "@/components/ui/granularity-picker";
import { GRANS_TIME } from "@/lib/granularity";
import { Kpi } from "@/components/webinar/Kpi";
import { fmt } from "@/components/webinar/format";
import Link from "next/link";

const PATHNAME = "/dashboards/high-level";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "High-Level CEO Dashboard · No More Mondays",
};

const pickStr = (v: string | string[] | undefined, fallback = ""): string =>
  typeof v === "string" ? v : fallback;

const GRAN_KEYS: ReadonlyArray<TrendGranularity> = ["day", "week", "month", "year"];

function pickGran(v: string | string[] | undefined): TrendGranularity | null {
  const s = pickStr(v);
  return GRAN_KEYS.includes(s as TrendGranularity)
    ? (s as TrendGranularity)
    : null;
}

export default async function HighLevelDashboardPage(
  props: PageProps<"/dashboards/high-level">,
) {
  const sp = await props.searchParams;
  // Unified DateRangeKey with Sun-Sat semantics; matches Sales/Setter.
  // Old PeriodKey values (`30d`, `7d`, …) are auto-translated for back-compat.
  const rawPeriod = pickStr(sp.period, "this-week");
  const translatedPeriod = translateLegacyPeriodKey(rawPeriod);
  const periodKey: DateRangeKey = isDateRangeKey(translatedPeriod)
    ? translatedPeriod
    : "this-week";
  const resolved = resolveDateRange({
    period: periodKey,
    from: pickStr(sp.from),
    to: pickStr(sp.to),
  });

  // Granularity: respect explicit ?gran=, else auto-suggest from the period
  // (7d/30d → day, 90d → week, YTD → month, etc.).
  const gran =
    pickGran(sp.gran) ??
    suggestGranularity({ from: resolved.from, to: resolved.to });

  const [days, cycles, user, devMode] = await Promise.all([
    getHighLevelRange({ from: resolved.from, to: resolved.to }),
    getSalesCyclesRange({ from: resolved.from, to: resolved.to }),
    getCurrentUser(),
    getDevMode(),
  ]);

  const kpis = computeCeoKpis(days);
  const aggregated = aggregateHighLevelByGran(days, gran);

  const updatedAt =
    days.length > 0 ? days[days.length - 1].dbt_updated_at : null;

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-3 sm:p-4 md:p-8 lg:p-10">
      {/* Hero */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-8">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
            No More Mondays &middot; CEO
          </p>
          <h1 className="font-heading text-4xl font-semibold tracking-tight md:text-5xl">
            High-Level
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Daily marketing + sales + sales-cycle rollup across all funnels.
            Live from{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
              dbt_tuddin.mart_high_level_daily
            </code>
            . Hover the{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono">i</code>{" "}
            on any metric for its formula.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <DateRangePicker pathname={PATHNAME} resolved={resolved} />
          <DataFreshness asOf={updatedAt} />
          <p className="text-xs text-muted-foreground tabular-nums">
            {fmt.date(resolved.from)} → {fmt.date(resolved.to)}
          </p>
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

      {/* Quick-button rail — same nine windows as Sales/Setter for parity. */}
      <DateRangeQuickButtons currentKey={periodKey} pathname={PATHNAME} />

      {periodKey === "this-week" ? (
        <p className="rounded-xl border border-alert-blue/30 bg-alert-blue/5 px-3 py-2 text-[12px] leading-relaxed text-foreground">
          <span className="font-medium text-alert-blue">Ongoing week</span> ·
          {" "}numbers may still update through Saturday as calls, deposits, and
          payments come in.
        </p>
      ) : null}

      {/* Hero KPIs — 4 primary metrics */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi
          label="Total Ad Spend"
          metric="total_ad_spend"
          devMode={devMode}
          size="hero"
          value={fmt.money(kpis.totalAdSpend)}
          sub="all Meta campaigns"
        />
        <Kpi
          label="Total Cash Collected"
          metric="total_cash_collected"
          devMode={devMode}
          size="hero"
          value={fmt.money(kpis.totalCashCollected)}
          sub="upfront at close"
        />
        <Kpi
          label="ROAS (TCC)"
          metric="roas_tcc"
          devMode={devMode}
          size="hero"
          value={fmt.ratio(kpis.roasTcc)}
          sub="cash / spend"
        />
        <Kpi
          label="Show Rate"
          metric="show_rate"
          devMode={devMode}
          size="hero"
          value={fmt.pct(kpis.showRate)}
          sub="show-ups / eligible"
        />
      </section>

      {/* KPI groups */}
      <MarketingKpis kpis={kpis} devMode={devMode} />
      <SalesKpis kpis={kpis} devMode={devMode} />
      <SalesCycleKpis cycles={cycles} devMode={devMode} />

      {/* Daily trend chart with granularity picker */}
      {days.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No data in mart_high_level_daily for this period.
        </p>
      ) : (
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Trend
              </p>
              <h2 className="font-heading text-2xl font-semibold tracking-tight">
                Over time
              </h2>
            </div>
            <GranularityPicker
              pathname="/dashboards/high-level"
              value={gran}
              options={GRANS_TIME}
            />
          </div>
          <DailyTrendChart days={aggregated} gran={gran} />
        </section>
      )}
    </main>
  );
}

// Old PeriodFilter keys → new DateRangeKey, so existing bookmarks /
// shared links don't 404 to the default after the switch.
const LEGACY_PERIOD_MAP: Record<string, DateRangeKey> = {
  "7d": "last-7d",
  "30d": "last-30d",
  "90d": "last-90d",
  mtd: "this-month",
  qtd: "ytd", // QTD has no exact replacement; YTD is the closest still-supported window.
  ytd: "ytd",
  custom: "custom",
};

function translateLegacyPeriodKey(s: string): string {
  return LEGACY_PERIOD_MAP[s] ?? s;
}

function DateRangeQuickButtons({
  currentKey,
  pathname,
}: {
  currentKey: DateRangeKey;
  pathname: string;
}) {
  return (
    <div className="-mx-1 flex flex-wrap gap-1 overflow-x-auto px-1 pb-1">
      {DATE_RANGE_OPTIONS.filter((o) => o.key !== "custom").map((o) => {
        const active = o.key === currentKey;
        return (
          <Link
            key={o.key}
            href={`${pathname}?period=${o.key}`}
            className={cn(
              "shrink-0 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors",
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

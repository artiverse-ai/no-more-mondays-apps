import Link from "next/link";

import { getCurrentUser } from "@/lib/auth";
import {
  computeCeoKpis,
  getHighLevelRange,
  getSalesCyclesRange,
  isPeriodKey,
  resolvePeriod,
  type PeriodKey,
} from "@/lib/highLevel";
import { DailyTrendChart } from "@/components/highLevel/DailyTrendChart";
import { MarketingKpis } from "@/components/highLevel/MarketingKpis";
import { PeriodFilter } from "@/components/highLevel/PeriodFilter";
import { SalesCycleKpis } from "@/components/highLevel/SalesCycleKpis";
import { SalesKpis } from "@/components/highLevel/SalesKpis";
import { fmt } from "@/components/webinar/format";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "High-Level CEO Dashboard · No More Mondays",
};

const pickStr = (v: string | string[] | undefined, fallback = ""): string =>
  typeof v === "string" ? v : fallback;

export default async function HighLevelDashboardPage(
  props: PageProps<"/dashboards/high-level">,
) {
  const sp = await props.searchParams;
  const rawPeriod = pickStr(sp.period, "30d");
  const periodKey: PeriodKey = isPeriodKey(rawPeriod) ? rawPeriod : "30d";
  const resolved = resolvePeriod({
    period: periodKey,
    from: pickStr(sp.from),
    to: pickStr(sp.to),
  });

  const [days, cycles, user] = await Promise.all([
    getHighLevelRange({ from: resolved.from, to: resolved.to }),
    getSalesCyclesRange({ from: resolved.from, to: resolved.to }),
    getCurrentUser(),
  ]);

  const kpis = computeCeoKpis(days);

  const updatedAt = days.length > 0 ? days[days.length - 1].dbt_updated_at : null;
  const updatedStr =
    updatedAt && !isNaN(new Date(updatedAt).getTime())
      ? new Date(updatedAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : null;

  return (
    <main className="mx-auto max-w-7xl space-y-8 p-4 md:p-8 lg:p-10">
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
            .
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{resolved.label}</span>{" "}
            &middot;{" "}
            <span className="tabular-nums">
              {fmt.date(resolved.from)} → {fmt.date(resolved.to)}
            </span>
            {updatedStr ? ` · dbt updated ${updatedStr}` : ""}
          </p>
          {user?.isAdmin ? (
            <Link
              href="/admin"
              className="rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground shadow-sm hover:border-accent hover:text-accent"
            >
              Admin
            </Link>
          ) : null}
        </div>
      </header>

      {/* Period filter */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <PeriodFilter
          period={resolved.period}
          from={resolved.from}
          to={resolved.to}
        />
      </section>

      {/* KPI groups */}
      <MarketingKpis kpis={kpis} />
      <SalesKpis kpis={kpis} />
      <SalesCycleKpis cycles={cycles} />

      {/* Daily trend chart */}
      {days.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No data in mart_high_level_daily for this period.
        </p>
      ) : (
        <DailyTrendChart days={days} />
      )}
    </main>
  );
}

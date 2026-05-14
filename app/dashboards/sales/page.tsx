import Link from "next/link";

import { getCurrentUser } from "@/lib/auth";
import { getDevMode } from "@/lib/dev-mode";
import {
  isPeriodKey,
  resolvePeriod,
  type PeriodKey,
} from "@/lib/highLevel";
import {
  aggregateByCloser,
  computeCloserTotals,
  getCloserPerformance,
  type CloserAggregate,
} from "@/lib/sales";
import { PeriodFilter } from "@/components/highLevel/PeriodFilter";
import { CloserLeaderboard } from "@/components/sales/CloserLeaderboard";
import { SalesHero } from "@/components/sales/SalesHero";
import { DevModeToggle } from "@/components/DevModeToggle";
import { fmt } from "@/components/webinar/format";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sales Performance · No More Mondays",
};

const pickStr = (v: string | string[] | undefined, fallback = ""): string =>
  typeof v === "string" ? v : fallback;

function sortClosers(
  rows: CloserAggregate[],
  key: string,
  dir: "asc" | "desc",
): CloserAggregate[] {
  const m = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = (a as unknown as Record<string, unknown>)[key];
    const bv = (b as unknown as Record<string, unknown>)[key];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * m;
    return String(av).localeCompare(String(bv)) * m;
  });
}

export default async function SalesDashboardPage(
  props: PageProps<"/dashboards/sales">,
) {
  const sp = await props.searchParams;
  const rawPeriod = pickStr(sp.period, "30d");
  const periodKey: PeriodKey = isPeriodKey(rawPeriod) ? rawPeriod : "30d";
  const resolved = resolvePeriod({
    period: periodKey,
    from: pickStr(sp.from),
    to: pickStr(sp.to),
  });
  const includeLegacy = pickStr(sp.legacy) === "1";
  const sort = pickStr(sp.sort, "cash_collected");
  const dir: "asc" | "desc" = pickStr(sp.dir, "desc") === "asc" ? "asc" : "desc";

  const [rows, user, devMode] = await Promise.all([
    getCloserPerformance({
      from: resolved.from,
      to: resolved.to,
      includeLegacy,
    }),
    getCurrentUser(),
    getDevMode(),
  ]);

  const totals = computeCloserTotals(rows);
  const aggregates = sortClosers(aggregateByCloser(rows), sort, dir);

  return (
    <main className="mx-auto max-w-7xl space-y-8 p-4 md:p-8 lg:p-10">
      {/* Hero */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-8">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
            No More Mondays &middot; Sales
          </p>
          <h1 className="font-heading text-4xl font-semibold tracking-tight md:text-5xl">
            Sales Performance
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Per-closer rollup of calls, deals, cash, and revenue. Live from{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
              dbt_tuddin.mart_closer_weekly_performance
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

      {/* Setter-DQ caveat callout (closer mart not yet updated to is_show_up) */}
      <p className="rounded-xl border border-alert-orange/30 bg-alert-orange/5 px-4 py-2.5 text-[12px] leading-relaxed text-foreground">
        <strong className="font-semibold text-alert-orange">Heads-up:</strong>{" "}
        the closer mart still uses the deprecated{" "}
        <code className="rounded bg-alert-orange/10 px-1 py-0.5 font-mono">
          is_call_held
        </code>{" "}
        flag, so &ldquo;Held&rdquo; and the rate denominators over-count Setter
        DQ rows by a small amount. Webinar dashboard already uses the
        PR-#43 fix; an upstream PR will rebuild this mart on{" "}
        <code className="rounded bg-alert-orange/10 px-1 py-0.5 font-mono">
          is_show_up
        </code>{" "}
        next.
      </p>

      {/* Period + legacy toggle */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <PeriodFilter
          period={resolved.period}
          from={resolved.from}
          to={resolved.to}
        />
        <LegacyToggle current={includeLegacy} />
      </section>

      {/* Hero KPIs */}
      <SalesHero totals={totals} devMode={devMode} />

      {/* Closer leaderboard */}
      <CloserLeaderboard rows={aggregates} sort={sort} dir={dir} />
    </main>
  );
}

function LegacyToggle({ current }: { current: boolean }) {
  return (
    <div className="mt-4 flex items-center gap-2 border-t border-border pt-4">
      <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
        Legacy era
      </span>
      <Link
        href={current ? "?legacy=0" : "?legacy=1"}
        className={`inline-flex h-7 items-center rounded-md border px-2.5 text-[11px] font-medium uppercase tracking-[0.12em] transition-colors ${
          current
            ? "border-alert-blue/40 bg-alert-blue/10 text-alert-blue"
            : "border-border bg-card text-muted-foreground hover:border-foreground/40 hover:text-foreground"
        }`}
      >
        {current ? "Including legacy" : "Excluded"}
      </Link>
      <span className="text-[11px] text-muted-foreground">
        Pre-2025-11-23 closer data used a manual sheet and different
        methodology. Off by default.
      </span>
    </div>
  );
}

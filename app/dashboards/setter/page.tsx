import Link from "next/link";

import { getCurrentUser } from "@/lib/auth";
import { getDevMode } from "@/lib/dev-mode";
import {
  isPeriodKey,
  resolvePeriod,
  type PeriodKey,
} from "@/lib/highLevel";
import {
  computeSetterTotals,
  getSetterPerformance,
  getSetterFlowOptions,
  type SetterRow,
} from "@/lib/setter";
import { PeriodFilter } from "@/components/highLevel/PeriodFilter";
import { SetterHero } from "@/components/setter/SetterHero";
import { SetterLeaderboard } from "@/components/setter/SetterLeaderboard";
import { DevModeToggle } from "@/components/DevModeToggle";
import { fmt } from "@/components/webinar/format";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Setter Performance · No More Mondays",
};

const pickStr = (v: string | string[] | undefined, fallback = ""): string =>
  typeof v === "string" ? v : fallback;

function sortSetters(
  rows: SetterRow[],
  key: string,
  dir: "asc" | "desc",
): SetterRow[] {
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

export default async function SetterDashboardPage(
  props: PageProps<"/dashboards/setter">,
) {
  const sp = await props.searchParams;
  const rawPeriod = pickStr(sp.period, "30d");
  const periodKey: PeriodKey = isPeriodKey(rawPeriod) ? rawPeriod : "30d";
  const resolved = resolvePeriod({
    period: periodKey,
    from: pickStr(sp.from),
    to: pickStr(sp.to),
  });
  const flow = pickStr(sp.flow);
  const sort = pickStr(sp.sort, "bookings");
  const dir: "asc" | "desc" = pickStr(sp.dir, "desc") === "asc" ? "asc" : "desc";

  const [rows, flowOptions, user, devMode] = await Promise.all([
    getSetterPerformance({
      from: resolved.from,
      to: resolved.to,
      flow: flow || undefined,
    }),
    getSetterFlowOptions({ from: resolved.from, to: resolved.to }),
    getCurrentUser(),
    getDevMode(),
  ]);

  const totals = computeSetterTotals(rows);
  const sorted = sortSetters(rows, sort, dir);

  return (
    <main className="mx-auto max-w-7xl space-y-8 p-4 md:p-8 lg:p-10">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-8">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
            No More Mondays &middot; Sales
          </p>
          <h1 className="font-heading text-4xl font-semibold tracking-tight md:text-5xl">
            Setter Performance
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Per-setter rollup of bookings, shows, qualification, and deal
            contribution. Live{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
              GROUP BY
            </code>{" "}
            over{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
              int_calls_enriched
            </code>
            . Uses the PR-#43{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
              is_show_up
            </code>{" "}
            field — Setter DQs are excluded from shows correctly.
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

      {/* Period + flow filter */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <PeriodFilter
          period={resolved.period}
          from={resolved.from}
          to={resolved.to}
        />
        <FlowFilter current={flow} options={flowOptions} />
      </section>

      {/* Hero KPIs */}
      <SetterHero totals={totals} devMode={devMode} />

      {/* Setter leaderboard */}
      <SetterLeaderboard rows={sorted} sort={sort} dir={dir} />
    </main>
  );
}

function FlowFilter({
  current,
  options,
}: {
  current: string;
  options: string[];
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
      <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
        Marketing flow
      </span>
      <FlowChip href="?flow=" label="All" active={!current} />
      {options.map((opt) => (
        <FlowChip
          key={opt}
          href={`?flow=${encodeURIComponent(opt)}`}
          label={opt}
          active={current === opt}
        />
      ))}
    </div>
  );
}

function FlowChip({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex h-7 items-center rounded-md border px-2.5 text-[11px] font-medium uppercase tracking-[0.12em] transition-colors ${
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-card text-muted-foreground hover:border-foreground/40 hover:text-foreground"
      }`}
    >
      {label}
    </Link>
  );
}

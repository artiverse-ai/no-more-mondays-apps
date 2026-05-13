import Link from "next/link";

import { getCurrentUser } from "@/lib/auth";
import {
  computeKpis,
  filterWebinars,
  funnelStages,
  getWebinars,
  sortWebinars,
} from "@/lib/webinar";
import { DealsChart } from "@/components/webinar/DealsChart";
import { FunnelChart } from "@/components/webinar/FunnelChart";
import { HeadlineKPIs } from "@/components/webinar/HeadlineKPIs";
import { RoasChart } from "@/components/webinar/RoasChart";
import { SpendCashChart } from "@/components/webinar/SpendCashChart";
import { WebinarFilters } from "@/components/webinar/WebinarFilters";
import { WebinarTable } from "@/components/webinar/WebinarTable";
import { fmt } from "@/components/webinar/format";

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

  const [all, user] = await Promise.all([getWebinars(), getCurrentUser()]);

  const days = [...new Set(all.map((w) => w.webinar_day))].filter(Boolean);
  const eras = [...new Set(all.map((w) => w.data_era))].filter(Boolean);

  const filtered = filterWebinars(all, { day, era, from, to });
  const sorted = sortWebinars(filtered, sort, dir);
  const kpis = computeKpis(filtered);

  const ascByDate = [...filtered].sort((a, b) =>
    a.webinar_date.localeCompare(b.webinar_date),
  );
  const latest = ascByDate[ascByDate.length - 1] ?? null;

  const updatedAt = all[0]?.dbt_updated_at;
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
            No More Mondays &middot; Analytics
          </p>
          <h1 className="font-heading text-4xl font-semibold tracking-tight md:text-5xl">
            Webinar Performance
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            End-to-end funnel — spend, registrations, attendance, calls, revenue.
            Live from{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
              dbt_tuddin.mart_webinar_events
            </code>
            .
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <p className="text-sm text-muted-foreground">
            {all.length} webinar{all.length === 1 ? "" : "s"}
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

      {/* Setter-DQ note on the new `shows` column (PR #43) */}
      <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-[11px] leading-relaxed text-amber-900">
        <strong className="font-semibold">Heads-up:</strong>{" "}
        <code className="rounded bg-amber-100 px-1 py-0.5 font-mono">shows</code>{" "}
        now excludes Setter DQs (PR #43 fix). Historical values may be smaller
        than the pre-2026-04-19 &ldquo;Calls Held&rdquo; you remember — this is
        a bug fix, not a regression.
      </p>

      {/* Filters */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <WebinarFilters
          days={days}
          eras={eras}
          day={day}
          era={era}
          from={from}
          to={to}
        />
      </section>

      {/* KPI cards */}
      <HeadlineKPIs kpis={kpis} rowCount={filtered.length} />

      {/* Charts */}
      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No webinars match these filters.
        </p>
      ) : (
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SpendCashChart rows={filtered} />
          <DealsChart rows={filtered} />
          <RoasChart rows={filtered} />
          {latest ? (
            <FunnelChart
              stages={funnelStages(latest)}
              title="Funnel — most recent webinar"
              subtitle={`${fmt.date(latest.webinar_date)} · ${latest.webinar_day}`}
              height="h-64"
            />
          ) : null}
        </section>
      )}

      {/* Per-webinar table */}
      <section className="space-y-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Detail
          </p>
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            Per-webinar breakdown
          </h2>
        </div>
        <WebinarTable rows={sorted} sort={sort} dir={dir} total={all.length} />
      </section>
    </main>
  );
}

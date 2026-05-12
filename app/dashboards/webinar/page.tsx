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
import { Kpi } from "@/components/webinar/Kpi";
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
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <Kpi label="Webinars" value={fmt.int(filtered.length)} />
        <Kpi label="Ad spend" value={fmt.money(kpis.spend)} />
        <Kpi label="Registrants" value={fmt.int(kpis.registrants)} />
        <Kpi label="Attendees" value={fmt.int(kpis.attendees)} />
        <Kpi label="Calls booked" value={fmt.int(kpis.booked)} />
        <Kpi label="Calls held" value={fmt.int(kpis.held)} />
        <Kpi label="Deals closed" value={fmt.int(kpis.deals)} />
        <Kpi label="Cash collected" value={fmt.money(kpis.cash)} />
        <Kpi label="Revenue generated" value={fmt.money(kpis.revenue)} />
        <Kpi
          label="Avg ROAS (cash)"
          value={kpis.roas == null ? "—" : fmt.ratio(kpis.roas)}
          sub="cash / spend"
        />
        <Kpi
          label="Avg CAC"
          value={kpis.cac == null ? "—" : fmt.money(kpis.cac)}
          sub="spend / deal"
        />
      </section>

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

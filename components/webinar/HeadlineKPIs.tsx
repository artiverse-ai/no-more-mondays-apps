// Webinar dashboard overview KPIs — split into:
//   <HeroKPIs>   — 4 large primary tiles on top of the page.
//   <AllMetrics> — collapsible disclosure with the rest (registrants,
//                  attendees, deals, revenue, CAC, etc.) for users who
//                  want every number on one page without it dominating
//                  the hero.
//
// Both are server components; pass `devMode` from the page (which reads
// the cookie via `getDevMode()` in lib/dev-mode.ts) so the InfoTips
// reveal SQL + source for developers only.

import { Kpi } from "./Kpi";
import { fmt } from "./format";
import type { WebinarKpis } from "@/lib/webinar";

export function HeroKPIs({
  kpis,
  devMode = false,
  deltas,
}: {
  kpis: WebinarKpis;
  devMode?: boolean;
  /** Optional period-over-period deltas, mapped per metric key. */
  deltas?: Partial<Record<"spend" | "cash" | "roas" | "shows", number | null>>;
}) {
  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Kpi
        label="Total Webinar Ad Spend"
        metric="total_webinar_ad_spend"
        devMode={devMode}
        size="hero"
        value={fmt.money(kpis.spend)}
        sub="all webinar campaigns"
        delta={deltas?.spend ?? null}
      />
      <Kpi
        label="Total Cash Collected"
        metric="cash_collected"
        devMode={devMode}
        size="hero"
        value={fmt.money(kpis.cash)}
        sub="upfront only"
        delta={deltas?.cash ?? null}
      />
      <Kpi
        label="ROAS (Cash)"
        metric="roas_cash"
        devMode={devMode}
        size="hero"
        value={kpis.roas == null ? "—" : fmt.ratio(kpis.roas)}
        sub="cash / spend"
        delta={deltas?.roas ?? null}
      />
      <Kpi
        label="Shows"
        metric="shows"
        devMode={devMode}
        size="hero"
        value={fmt.int(kpis.shows)}
        sub="excludes Setter DQs"
        delta={deltas?.shows ?? null}
      />
    </section>
  );
}

export function AllMetrics({
  kpis,
  rowCount,
  devMode = false,
}: {
  kpis: WebinarKpis;
  rowCount: number;
  devMode?: boolean;
}) {
  return (
    <details className="group rounded-2xl border border-border bg-card/40 shadow-sm">
      <summary
        className="flex cursor-pointer list-none items-center justify-between rounded-2xl px-5 py-3 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:bg-muted/40 group-open:rounded-b-none group-open:border-b group-open:border-border"
        style={{ transitionTimingFunction: "var(--ease-out)" }}
      >
        <span>All metrics</span>
        <span
          aria-hidden
          className="text-base text-muted-foreground/70 transition-transform group-open:rotate-90"
        >
          ›
        </span>
      </summary>
      <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-4 lg:grid-cols-5">
        <Kpi
          label="Webinars"
          value={fmt.int(rowCount)}
          sub="rows in current filter"
        />
        <Kpi
          label="Registrants"
          metric="total_registrants"
          devMode={devMode}
          value={fmt.int(kpis.registrants)}
        />
        <Kpi
          label="Attendees"
          metric="unique_attendees"
          devMode={devMode}
          value={fmt.int(kpis.attendees)}
        />
        <Kpi
          label="Calls Booked"
          metric="calls_booked"
          devMode={devMode}
          value={fmt.int(kpis.booked)}
        />
        <Kpi
          label="Deals Closed"
          metric="deals_closed"
          devMode={devMode}
          value={fmt.int(kpis.deals)}
        />
        <Kpi
          label="Revenue (TCV)"
          metric="revenue_generated"
          devMode={devMode}
          value={fmt.money(kpis.revenue)}
        />
        <Kpi
          label="Avg CAC"
          metric="cac"
          devMode={devMode}
          value={kpis.cac == null ? "—" : fmt.money(kpis.cac)}
          sub="spend / deal"
        />
      </div>
    </details>
  );
}

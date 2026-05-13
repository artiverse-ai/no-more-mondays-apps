// Overview-page KPI tiles for /dashboards/webinar.
// Server component — no hooks, no client boundary.
//
// Tile structure kept incremental on the previous design (rename in place);
// the doc's tighter 8-tile rollup lives on the new CEO dashboard at
// /dashboards/high-level.

import { Kpi } from "./Kpi";
import { fmt } from "./format";
import type { WebinarKpis } from "@/lib/webinar";

export function HeadlineKPIs({
  kpis,
  rowCount,
}: {
  kpis: WebinarKpis;
  rowCount: number;
}) {
  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
      <Kpi label="Webinars" value={fmt.int(rowCount)} />
      <Kpi label="Total Webinar Ad Spend" value={fmt.money(kpis.spend)} />
      <Kpi label="Registrants" value={fmt.int(kpis.registrants)} />
      <Kpi label="Attendees" value={fmt.int(kpis.attendees)} />
      <Kpi label="Calls booked" value={fmt.int(kpis.booked)} />
      <Kpi label="Shows" value={fmt.int(kpis.shows)} />
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
  );
}

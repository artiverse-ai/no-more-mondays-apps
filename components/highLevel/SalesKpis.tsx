import { Kpi } from "@/components/webinar/Kpi";
import { fmt } from "@/components/webinar/format";
import type { CeoKpis } from "@/lib/highLevel";

export function SalesKpis({
  kpis,
  devMode = false,
}: {
  kpis: CeoKpis;
  devMode?: boolean;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        Sales
      </h3>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi
          label="Show Rate"
          metric="show_rate"
          devMode={devMode}
          value={fmt.pct(kpis.showRate)}
          sub="show-ups / eligible"
        />
        <Kpi
          label="Close Rate (Shows)"
          metric="close_rate_on_shows"
          devMode={devMode}
          value={fmt.pct(kpis.closeRateOnShows)}
          sub="deals / show-ups"
        />
        <Kpi
          label="Close Rate (Qualified)"
          metric="close_rate_closer_qualified"
          devMode={devMode}
          value={fmt.pct(kpis.closeRateCloserQualified)}
          sub="deals / closer-qualified"
        />
        <Kpi
          label="Setter DQ Rate"
          metric="setter_dq_rate"
          devMode={devMode}
          value={fmt.pct(kpis.setterDqRate)}
          sub="setter DQs / dispositioned"
        />
        <Kpi
          label="Closer DQ Rate"
          metric="closer_dq_rate"
          devMode={devMode}
          value={fmt.pct(kpis.closerDqRate)}
          sub="closer DQs / show-ups"
        />
        <Kpi
          label="AOV"
          metric="aov"
          devMode={devMode}
          value={fmt.money(kpis.aov)}
          sub="cash / deal"
        />
        <Kpi
          label="ACV"
          metric="acv"
          devMode={devMode}
          value={fmt.money(kpis.acv)}
          sub="contracted / deal"
        />
        <Kpi
          label="PIF Rate"
          metric="pif_rate"
          devMode={devMode}
          value={fmt.pct(kpis.pifRate)}
          sub="paid-in-full / deals"
        />
        <Kpi
          label="Cash Collection Rate"
          metric="cash_collection_rate"
          devMode={devMode}
          value={fmt.pct(kpis.cashCollectionRate)}
          sub="cash / contracted (TCV)"
        />
      </div>
    </section>
  );
}

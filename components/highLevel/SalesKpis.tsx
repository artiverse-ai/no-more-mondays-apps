import { Kpi } from "@/components/webinar/Kpi";
import { fmt } from "@/components/webinar/format";
import type { CeoKpis } from "@/lib/highLevel";

export function SalesKpis({ kpis }: { kpis: CeoKpis }) {
  return (
    <section className="space-y-3">
      <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        Sales
      </h3>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi
          label="Show Rate"
          value={fmt.pct(kpis.showRate)}
          sub="show-ups / eligible"
        />
        <Kpi
          label="Close Rate (shows)"
          value={fmt.pct(kpis.closeRateOnShows)}
          sub="deals / show-ups"
        />
        <Kpi
          label="Close Rate (qualified)"
          value={fmt.pct(kpis.closeRateCloserQualified)}
          sub="deals / closer-qualified"
        />
        <Kpi
          label="Setter DQ Rate"
          value={fmt.pct(kpis.setterDqRate)}
          sub="setter DQs / dispositioned"
        />
        <Kpi
          label="Closer DQ Rate"
          value={fmt.pct(kpis.closerDqRate)}
          sub="closer DQs / show-ups"
        />
        <Kpi label="AOV" value={fmt.money(kpis.aov)} sub="cash / deal" />
        <Kpi label="ACV" value={fmt.money(kpis.acv)} sub="contracted / deal" />
        <Kpi
          label="PIF Rate"
          value={fmt.pct(kpis.pifRate)}
          sub="paid-in-full / deals"
        />
      </div>
    </section>
  );
}

import { Kpi } from "@/components/webinar/Kpi";
import { fmt } from "@/components/webinar/format";
import type { CeoKpis } from "@/lib/highLevel";

export function MarketingKpis({ kpis }: { kpis: CeoKpis }) {
  return (
    <section className="space-y-3">
      <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        Marketing
      </h3>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi
          label="Total Ad Spend"
          value={fmt.money(kpis.totalAdSpend)}
          sub="all Meta campaigns"
        />
        <Kpi
          label="Total Calls Booked"
          value={fmt.int(kpis.totalCallsBooked)}
          sub="strategy calls only"
        />
        <Kpi
          label="Total Cash Collected"
          value={fmt.money(kpis.totalCashCollected)}
        />
        <Kpi
          label="Total Revenue (TCV)"
          value={fmt.money(kpis.totalRevenueContracted)}
        />
        <Kpi
          label="Cost Per Booked Call"
          value={fmt.money2(kpis.costPerBookedCall)}
          sub="ad spend / booked"
        />
        <Kpi
          label="Cash Per Booked Call"
          value={fmt.money2(kpis.cashPerBookedCall)}
          sub="cash / booked"
        />
        <Kpi
          label="ROAS (TCC)"
          value={fmt.ratio(kpis.roasTcc)}
          sub="cash / spend"
        />
        <Kpi
          label="ROAS (TCV)"
          value={fmt.ratio(kpis.roasTcv)}
          sub="contracted / spend"
        />
      </div>
    </section>
  );
}

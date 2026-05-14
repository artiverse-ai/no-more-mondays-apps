import { Kpi } from "@/components/webinar/Kpi";
import { fmt } from "@/components/webinar/format";
import type { CloserTotals } from "@/lib/sales";

export function SalesHero({
  totals,
  devMode = false,
}: {
  totals: CloserTotals;
  devMode?: boolean;
}) {
  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Kpi
        label="Total Cash Collected"
        metric="cash_collected"
        devMode={devMode}
        size="hero"
        value={fmt.money(totals.cash_collected)}
        sub={`${totals.closer_count} closer${totals.closer_count === 1 ? "" : "s"}`}
      />
      <Kpi
        label="Deals Closed Won"
        metric="closer_deals_closed_won"
        devMode={devMode}
        size="hero"
        value={fmt.int(totals.deals_closed_won)}
      />
      <Kpi
        label="Close Rate"
        metric="closer_close_rate"
        devMode={devMode}
        size="hero"
        value={fmt.pct(totals.close_rate)}
        sub="deals / calls held"
      />
      <Kpi
        label="AOV"
        metric="closer_aov"
        devMode={devMode}
        size="hero"
        value={fmt.money(totals.aov)}
        sub="cash / deal"
      />
    </section>
  );
}

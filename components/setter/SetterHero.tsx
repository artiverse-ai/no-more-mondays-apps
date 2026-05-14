import { Kpi } from "@/components/webinar/Kpi";
import { fmt } from "@/components/webinar/format";
import type { SetterTotals } from "@/lib/setter";

export function SetterHero({
  totals,
  devMode = false,
}: {
  totals: SetterTotals;
  devMode?: boolean;
}) {
  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Kpi
        label="Bookings"
        metric="setter_bookings"
        devMode={devMode}
        size="hero"
        value={fmt.int(totals.bookings)}
        sub={`${totals.setter_count} setter${totals.setter_count === 1 ? "" : "s"}`}
      />
      <Kpi
        label="Show Rate"
        metric="setter_show_rate"
        devMode={devMode}
        size="hero"
        value={fmt.pct(totals.show_rate)}
        sub="shows / eligible"
      />
      <Kpi
        label="Setter DQ Rate"
        metric="setter_dq_rate"
        devMode={devMode}
        size="hero"
        value={fmt.pct(totals.setter_dq_rate)}
        sub="DQs / dispositioned"
      />
      <Kpi
        label="Cash / Booking"
        metric="setter_cash_per_booking"
        devMode={devMode}
        size="hero"
        value={fmt.money2(totals.cash_per_booking)}
        sub="attributed cash"
      />
    </section>
  );
}

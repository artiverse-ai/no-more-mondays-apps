import { Kpi } from "@/components/webinar/Kpi";
import {
  averageBookingToClose,
  averageFirstCallToClose,
  medianBookingToClose,
  medianFirstCallToClose,
  type SalesCycleRow,
} from "@/lib/highLevel";

// Days label: "12 d" (int) or "11.5 d" (one decimal). Median of even-N
// sets can be a half-day, and averages routinely have a fractional part.
function daysLabel(value: number | null): string {
  if (value == null) return "—";
  return `${Number.isInteger(value) ? value : value.toFixed(1)} d`;
}

export function SalesCycleKpis({
  cycles,
  devMode = false,
}: {
  cycles: SalesCycleRow[];
  devMode?: boolean;
}) {
  // Both halves shown side-by-side per Monday-report lock: "both median
  // and average for both values" (§4.11–4.14).
  const occMedian = medianBookingToClose(cycles);
  const fucMedian = medianFirstCallToClose(cycles);
  const occAvg = averageBookingToClose(cycles);
  const fucAvg = averageFirstCallToClose(cycles);

  return (
    <section className="space-y-3">
      <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        Sales cycle &middot; median &amp; average
      </h3>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi
          label="Median Book → Close (OCC)"
          metric="median_booking_to_close_occ"
          devMode={devMode}
          value={daysLabel(occMedian.value)}
          sub={`${occMedian.n} OCC deal${occMedian.n === 1 ? "" : "s"}`}
        />
        <Kpi
          label="Avg Book → Close (OCC)"
          metric="median_booking_to_close_occ"
          devMode={devMode}
          value={daysLabel(occAvg.value)}
          sub={`${occAvg.n} OCC deal${occAvg.n === 1 ? "" : "s"}`}
        />
        <Kpi
          label="Median 1st Call → Close (FUC)"
          metric="median_first_call_to_close_fuc"
          devMode={devMode}
          value={daysLabel(fucMedian.value)}
          sub={`${fucMedian.n} FUC deal${fucMedian.n === 1 ? "" : "s"}`}
        />
        <Kpi
          label="Avg 1st Call → Close (FUC)"
          metric="median_first_call_to_close_fuc"
          devMode={devMode}
          value={daysLabel(fucAvg.value)}
          sub={`${fucAvg.n} FUC deal${fucAvg.n === 1 ? "" : "s"}`}
        />
      </div>
    </section>
  );
}

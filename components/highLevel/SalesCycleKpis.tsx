import { Kpi } from "@/components/webinar/Kpi";
import {
  medianBookingToClose,
  medianFirstCallToClose,
  type SalesCycleRow,
} from "@/lib/highLevel";

function daysLabel(value: number | null): string {
  if (value == null) return "—";
  // booking_to_close_days / first_call_to_close_days are whole-day BQ INT64s
  // most of the time, but the median of an even-length set can be .5.
  return `${Number.isInteger(value) ? value : value.toFixed(1)} d`;
}

export function SalesCycleKpis({ cycles }: { cycles: SalesCycleRow[] }) {
  const occ = medianBookingToClose(cycles);
  const fuc = medianFirstCallToClose(cycles);

  return (
    <section className="space-y-3">
      <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        Sales cycle &middot; median
      </h3>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Kpi
          label="Booking → Close (OCC)"
          value={daysLabel(occ.value)}
          sub={`${occ.n} OCC deal${occ.n === 1 ? "" : "s"} · median(booking_to_close_days)`}
        />
        <Kpi
          label="First Call → Close (FUC)"
          value={daysLabel(fuc.value)}
          sub={`${fuc.n} FUC deal${fuc.n === 1 ? "" : "s"} · median(first_call_to_close_days)`}
        />
      </div>
    </section>
  );
}

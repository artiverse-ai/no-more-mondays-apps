// Paginated drill-through table of every call in the current filtered
// set. Server component — renders the rows produced by lib/calls.ts
// without further client-side state.

import { fmt } from "@/components/webinar/format";
import type { CallRow } from "@/lib/calls";

const PAGE_SIZE = 100;
const shortEmail = (e: string | null) =>
  e && e.includes("@") ? e.split("@")[0] : e ?? "—";

export function CallsDrillThrough({
  rows,
  page,
  pathname,
  searchParams,
}: {
  rows: CallRow[];
  page: number;
  pathname: string;
  /** Current URL search params — used to preserve filters in pagination links. */
  searchParams: URLSearchParams;
}) {
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const slice = rows.slice(start, start + PAGE_SIZE);

  const pageHref = (n: number) => {
    const next = new URLSearchParams(searchParams);
    if (n <= 1) next.delete("page");
    else next.set("page", String(n));
    return `${pathname}?${next.toString()}`;
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2.5">
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Calls · {rows.length.toLocaleString()} matching
        </span>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          page {safePage} / {totalPages}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              <th className="px-3 py-2 text-left">Appt / Deal</th>
              <th className="px-3 py-2 text-left">Prospect</th>
              <th className="px-3 py-2 text-left">Source</th>
              <th className="px-3 py-2 text-left">Closer</th>
              <th className="px-3 py-2 text-left">Setter</th>
              <th className="px-3 py-2 text-left">Outcome</th>
              <th className="px-3 py-2 text-left">Loss / Notes</th>
              <th className="px-3 py-2 text-left">OCC/FUC</th>
              <th className="px-3 py-2 text-right">Cash</th>
            </tr>
          </thead>
          <tbody>
            {slice.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-3 py-10 text-center text-muted-foreground"
                >
                  No calls match the current filters.
                </td>
              </tr>
            ) : (
              slice.map((c, i) => {
                const setter = c.setter_owner ?? c.calendly_setter_name;
                const appt = c.appointment_date_time
                  ? fmt.dt(c.appointment_date_time)
                  : "—";
                const closed = c.date_closed ? ` · closed ${fmt.date(c.date_closed)}` : "";
                return (
                  <tr
                    key={`${c.prospect_email_lc ?? "?"}-${c.appointment_date_time ?? i}`}
                    className="border-b border-border/60 last:border-b-0 hover:bg-muted/30"
                  >
                    <td className="whitespace-nowrap px-3 py-2 text-[12px] tabular-nums text-muted-foreground">
                      {appt}
                      <span className="block text-[10.5px] text-muted-foreground/70">
                        {closed.replace(/^ · /, "")}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{c.prospect_name ?? "—"}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {c.prospect_email_lc ?? ""}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                      {c.final_marketing_flow ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {shortEmail(c.closer_owner)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {shortEmail(setter)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <OutcomeBadge call={c} />
                    </td>
                    <td className="max-w-[26ch] truncate px-3 py-2 text-muted-foreground" title={c.loss_reason_display ?? c.payment_notes ?? ""}>
                      {c.loss_reason_display ?? c.payment_notes ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                      {c.close_type ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                      {c.is_deal ? fmt.money(c.cash_collected) : "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <nav className="flex items-center justify-between border-t border-border bg-card/50 px-4 py-2 text-[11px]">
          <a
            href={pageHref(safePage - 1)}
            aria-disabled={safePage <= 1}
            className={
              "rounded-md px-2 py-1 text-muted-foreground hover:text-foreground " +
              (safePage <= 1 ? "pointer-events-none opacity-30" : "")
            }
          >
            ← Previous
          </a>
          <span className="text-muted-foreground tabular-nums">
            {start + 1}–{Math.min(start + PAGE_SIZE, rows.length)} of{" "}
            {rows.length}
          </span>
          <a
            href={pageHref(safePage + 1)}
            aria-disabled={safePage >= totalPages}
            className={
              "rounded-md px-2 py-1 text-muted-foreground hover:text-foreground " +
              (safePage >= totalPages ? "pointer-events-none opacity-30" : "")
            }
          >
            Next →
          </a>
        </nav>
      ) : null}
    </div>
  );
}

function OutcomeBadge({ call }: { call: CallRow }) {
  // Order: Deal → Deposit → Setter DQ → Closer DQ → Show → Canceled →
  // Rescheduled → Ghosted → fallback to call_outcome.
  let label = "—";
  let tone = "bg-muted/60 text-muted-foreground";
  if (call.is_deal) {
    label = "Deal";
    tone = "bg-alert-green/15 text-alert-green";
  } else if (call.is_deposit) {
    label = "Deposit";
    tone = "bg-alert-blue/15 text-alert-blue";
  } else if (call.call_outcome === "Setter DQ") {
    label = "Setter DQ";
    tone = "bg-alert-orange/15 text-alert-orange";
  } else if (call.call_outcome === "Closer DQ") {
    label = "Closer DQ";
    tone = "bg-alert-yellow/15 text-alert-yellow";
  } else if (call.is_show_up) {
    label = "Showed";
    tone = "bg-foreground/10 text-foreground";
  } else if (call.is_canceled) {
    label = call.is_canceled_by_prospect ? "Canceled (prospect)" : "Canceled";
    tone = "bg-alert-red/10 text-alert-red";
  } else if (call.is_rescheduled) {
    label = "Rescheduled";
    tone = "bg-muted text-muted-foreground";
  } else if (call.is_ghosted) {
    label = "No-show";
    tone = "bg-alert-red/10 text-alert-red";
  } else if (call.call_outcome) {
    label = call.call_outcome;
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-medium ${tone}`}>
      {label}
    </span>
  );
}

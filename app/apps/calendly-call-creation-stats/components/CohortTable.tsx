"use client";

import { Row } from "../lib/types";

const fmtUsd0 = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const fmtPct = (frac: number | null) => (frac == null ? "—" : `${Math.round(frac * 100)}%`);

const fmtWeek = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "America/New_York",
});

// Group bookings by Sunday-of-creation. Each row tells you: of bookings made
// that week, how many were eligible for show (past + non-canceled), how many
// got held, how many closed, how much cash. Lets the CEO compare "are last
// week's bookings converting better than 3 weeks ago?".
//
// Show % denominator = eligible (past + non-canceled), matching the Sales /
// Weekly Report dashboards. NOT total bookings — future calls can't be held
// yet, canceled ones never had a chance.
export function CohortTable({ rows }: { rows: Row[] }) {
  // Bucket by Sunday-of-creation (ET).
  type Bucket = {
    bookings: number;
    future: number;
    canceled: number;
    eligible: number; // past + non-canceled
    held: number;
    deals: number;
    cash: number;
    enriched: number;
  };
  const cohorts = new Map<string, Bucket>();
  for (const r of rows) {
    const created = new Date(r.createdAt);
    if (Number.isNaN(created.getTime())) continue;
    const sunday = new Date(created);
    // Shift back to most recent Sunday (UTC)
    sunday.setUTCDate(sunday.getUTCDate() - sunday.getUTCDay());
    sunday.setUTCHours(0, 0, 0, 0);
    const key = sunday.toISOString().slice(0, 10);
    const cur = cohorts.get(key) ?? {
      bookings: 0, future: 0, canceled: 0, eligible: 0,
      held: 0, deals: 0, cash: 0, enriched: 0,
    };
    cur.bookings++;
    if (r.callStatus === "future") cur.future++;
    else if (r.callStatus === "canceled") cur.canceled++;
    else cur.eligible++;
    if (r.wasHeld !== null || r.isDeal !== null) cur.enriched++;
    if (r.wasHeld === true) cur.held++;
    if (r.isDeal === true) cur.deals++;
    cur.cash += r.cashCollected ?? 0;
    cohorts.set(key, cur);
  }
  const sorted = [...cohorts.entries()].sort(([a], [b]) => b.localeCompare(a));

  if (sorted.length === 0) {
    return null;
  }

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
        Conversion by week-of-creation
      </h3>
      <div className="overflow-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Week of</th>
              <th className="px-3 py-2 text-right font-medium">Bookings</th>
              <th className="px-3 py-2 text-right font-medium" title="Past + non-canceled bookings — could have been held">Eligible</th>
              <th className="px-3 py-2 text-right font-medium">Held</th>
              <th className="px-3 py-2 text-right font-medium" title="Held / Eligible">Show %</th>
              <th className="px-3 py-2 text-right font-medium">Deals</th>
              <th className="px-3 py-2 text-right font-medium" title="Deals / Held">Close %</th>
              <th className="px-3 py-2 text-right font-medium">Cash</th>
              <th className="px-3 py-2 text-right font-medium">Cash / booking</th>
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            {sorted.map(([weekStart, c]) => {
              const date = new Date(weekStart + "T12:00:00Z");
              const showPct = c.eligible > 0 ? c.held / c.eligible : null;
              const closePct = c.held > 0 ? c.deals / c.held : null;
              return (
                <tr key={weekStart} className="border-t border-border">
                  <td className="px-3 py-2 text-left">{fmtWeek.format(date)}</td>
                  <td className="px-3 py-2 text-right">{c.bookings}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{c.eligible}</td>
                  <td className="px-3 py-2 text-right">{c.enriched > 0 ? c.held : "—"}</td>
                  <td className="px-3 py-2 text-right">{fmtPct(showPct)}</td>
                  <td className="px-3 py-2 text-right">{c.enriched > 0 ? c.deals : "—"}</td>
                  <td className="px-3 py-2 text-right">{fmtPct(closePct)}</td>
                  <td className="px-3 py-2 text-right">{c.cash > 0 ? fmtUsd0(c.cash) : "—"}</td>
                  <td className="px-3 py-2 text-right">{c.bookings > 0 && c.cash > 0 ? fmtUsd0(c.cash / c.bookings) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

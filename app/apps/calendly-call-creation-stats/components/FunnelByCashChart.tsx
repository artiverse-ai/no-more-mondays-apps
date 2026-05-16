"use client";

import { Row } from "../lib/types";

const fmtUsd0 = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

// Horizontal stacked bar — funnel (internal_note) ranked by cash collected
// from bookings in the window. Tells the CEO which funnels actually print
// money, not just which ones drive the most volume.
export function FunnelByCashChart({ rows }: { rows: Row[] }) {
  const byNote = new Map<string, { bookings: number; cash: number; deals: number; held: number }>();
  for (const r of rows) {
    const key = r.internalNote || "(no tag)";
    const cur = byNote.get(key) ?? { bookings: 0, cash: 0, deals: 0, held: 0 };
    cur.bookings++;
    cur.cash += r.cashCollected ?? 0;
    if (r.isDeal === true) cur.deals++;
    if (r.wasHeld === true) cur.held++;
    byNote.set(key, cur);
  }
  const sorted = [...byNote.entries()]
    .map(([note, c]) => ({ note, ...c }))
    .sort((a, b) => b.cash - a.cash);

  if (sorted.length === 0) return null;
  const maxCash = sorted[0].cash || 1;
  const anyCash = sorted.some((s) => s.cash > 0);

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
        Funnel ranked by cash {anyCash ? "" : "(no cash data yet — awaiting BQ)"}
      </h3>
      <div className="space-y-1.5 rounded-xl border border-border bg-card p-3 shadow-sm">
        {sorted.map((s) => {
          const w = maxCash > 0 ? (s.cash / maxCash) * 100 : 0;
          return (
            <div key={s.note} className="flex items-center gap-3">
              <div className="w-40 shrink-0 truncate text-xs" title={s.note}>
                {s.note}
              </div>
              <div className="relative h-5 flex-1 overflow-hidden rounded bg-muted/30">
                <div
                  className="absolute inset-y-0 left-0 rounded bg-amber-400/60"
                  style={{ width: `${w}%` }}
                />
              </div>
              <div className="w-24 shrink-0 text-right font-mono text-xs tabular-nums">
                {s.cash > 0 ? fmtUsd0(s.cash) : "—"}
              </div>
              <div className="w-16 shrink-0 text-right text-[10px] text-muted-foreground tabular-nums">
                {s.bookings} bk
              </div>
              <div className="w-12 shrink-0 text-right text-[10px] text-muted-foreground tabular-nums">
                {s.deals > 0 ? `${s.deals} d` : "—"}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

"use client";

import { Row } from "../lib/types";

// Median / P25 / P75 of (start_time − created_at), expressed in days. Tells
// you how far ahead people book. Tight low band = high-intent same-day
// bookers; wide high band = long sales-cycle / scheduled-far-out bookings.
export function TimeToCallStat({ rows }: { rows: Row[] }) {
  const stats = (() => {
    const diffs = rows
      .map((r) => {
        const start = Date.parse(r.startTime);
        const created = Date.parse(r.createdAt);
        if (!Number.isFinite(start) || !Number.isFinite(created)) return null;
        return (start - created) / 86400000; // days
      })
      .filter((n): n is number => n !== null)
      .sort((a, b) => a - b);
    if (diffs.length === 0) return null;
    const q = (frac: number) => diffs[Math.max(0, Math.min(diffs.length - 1, Math.floor(diffs.length * frac)))];
    return { p25: q(0.25), median: q(0.5), p75: q(0.75), n: diffs.length };
  })();

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Time-to-Call (days)
        </div>
        {stats ? (
          <span className="text-[10px] text-muted-foreground">n = {stats.n}</span>
        ) : null}
      </div>
      {stats ? (
        <div className="mt-1 flex items-baseline gap-3">
          <span className="font-mono text-2xl font-semibold tabular-nums text-foreground">
            {stats.median.toFixed(1)}
          </span>
          <span className="text-[11px] text-muted-foreground">median</span>
          <span className="text-border">·</span>
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            P25 {stats.p25.toFixed(1)} / P75 {stats.p75.toFixed(1)}
          </span>
        </div>
      ) : (
        <div className="mt-1 font-mono text-2xl font-semibold text-muted-foreground">—</div>
      )}
      <div className="mt-1 text-[11px] text-muted-foreground">
        How far ahead bookings are scheduled. Tight low band = high intent.
      </div>
    </div>
  );
}

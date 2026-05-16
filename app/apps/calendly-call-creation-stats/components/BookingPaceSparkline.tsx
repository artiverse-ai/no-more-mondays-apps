"use client";

import { Row } from "../lib/types";

// Last 30 days of daily booking count compared to the previous 30-day
// average. Single-line indication of whether bookings are heating up,
// cooling off, or steady. Bar = day, line = 30-day baseline.
export function BookingPaceSparkline({ rows }: { rows: Row[] }) {
  // Bucket all rows by yyyy-mm-dd (ET).
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" });
  const buckets = new Map<string, number>();
  for (const r of rows) {
    const d = new Date(r.createdAt);
    if (Number.isNaN(d.getTime())) continue;
    const k = fmt.format(d);
    buckets.set(k, (buckets.get(k) ?? 0) + 1);
  }
  // Build a contiguous last-60-day series so the chart has consistent spacing.
  const today = new Date();
  const series: { date: string; count: number; bucket: "recent30" | "prior30" }[] = [];
  for (let i = 59; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const k = fmt.format(d);
    series.push({ date: k, count: buckets.get(k) ?? 0, bucket: i < 30 ? "recent30" : "prior30" });
  }
  const recent = series.filter((s) => s.bucket === "recent30");
  const prior = series.filter((s) => s.bucket === "prior30");
  const recentTotal = recent.reduce((s, r) => s + r.count, 0);
  const priorTotal = prior.reduce((s, r) => s + r.count, 0);
  const priorAvgPerDay = prior.length > 0 ? priorTotal / prior.length : 0;
  const max = Math.max(1, ...series.map((s) => s.count), priorAvgPerDay * 2);
  const deltaPct = priorTotal > 0 ? Math.round(((recentTotal - priorTotal) / priorTotal) * 100) : null;

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Booking pace · last 30d vs prior 30d
        </div>
        {deltaPct !== null ? (
          <span
            className={`text-xs font-medium ${
              deltaPct >= 10 ? "text-emerald-600" : deltaPct <= -10 ? "text-rose-600" : "text-muted-foreground"
            }`}
          >
            {deltaPct >= 0 ? "+" : ""}
            {deltaPct}%
          </span>
        ) : null}
      </div>
      <div className="mt-1 flex items-baseline gap-3">
        <span className="font-mono text-2xl font-semibold tabular-nums text-foreground">{recentTotal}</span>
        <span className="text-[11px] text-muted-foreground">last 30d</span>
        <span className="text-border">·</span>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          prior 30d {priorTotal}
        </span>
      </div>
      <svg viewBox={`0 0 ${series.length * 4} 32`} className="mt-2 h-8 w-full">
        {series.map((s, i) => {
          const h = (s.count / max) * 28;
          return (
            <rect
              key={s.date}
              x={i * 4}
              y={32 - h}
              width={3}
              height={h}
              fill={s.bucket === "recent30" ? "#3b82f6" : "#cbd5e1"}
              rx={0.5}
            />
          );
        })}
        {/* Baseline line at priorAvgPerDay */}
        {priorAvgPerDay > 0 ? (
          <line
            x1={0}
            x2={series.length * 4}
            y1={32 - (priorAvgPerDay / max) * 28}
            y2={32 - (priorAvgPerDay / max) * 28}
            stroke="#94a3b8"
            strokeWidth={0.5}
            strokeDasharray="2 2"
          />
        ) : null}
      </svg>
      <div className="mt-1 text-[10px] text-muted-foreground">
        Blue bars = last 30 days · grey bars = prior 30 days · dashed line = prior 30-day average
      </div>
    </div>
  );
}

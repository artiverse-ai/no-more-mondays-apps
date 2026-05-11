"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { RangeSlot } from "@/lib/availability";

export function TimeOfDayChart({
  slots,
  totalMembers,
  tz,
}: {
  slots: RangeSlot[];
  totalMembers: number;
  tz: string;
}) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: tz,
  });

  // Aggregate by slot time (HH:mm in TZ): avg + max free across days
  type Bucket = { samples: number[]; total: number };
  const byTime = new Map<string, Bucket>();
  for (const s of slots) {
    const t = fmt.format(new Date(s.slot_start));
    const b = byTime.get(t) || { samples: [], total: 0 };
    b.samples.push(s.available_count);
    b.total += s.available_count;
    byTime.set(t, b);
  }

  const data = Array.from(byTime.entries())
    .sort()
    .map(([time, b]) => {
      const sum = b.samples.reduce((a, x) => a + x, 0);
      const avg = sum / b.samples.length;
      const max = Math.max(...b.samples);
      const min = Math.min(...b.samples);
      return {
        time,
        avg_free: Number(avg.toFixed(2)),
        max_free: max,
        min_free: min,
      };
    });

  if (data.length === 0) return null;

  const overallAvg = data.reduce((s, x) => s + x.avg_free, 0) / data.length;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        Availability by time of day
      </p>
      <h3 className="mt-1 font-heading text-lg font-semibold">
        When is the team most free?
      </h3>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Avg closers free at each slot time, across the days in this range.
      </p>

      <div className="mt-4 h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 4 }}>
            <defs>
              <linearGradient id="todGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--nmm-green)" stopOpacity={0.45} />
                <stop offset="100%" stopColor="var(--nmm-green)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="time"
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, totalMembers]}
              allowDecimals={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              width={28}
            />
            <Tooltip
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
                color: "var(--foreground)",
              }}
              labelStyle={{ color: "var(--muted-foreground)", marginBottom: 4 }}
              formatter={(v, name, item) => {
                const p = item.payload as { avg_free: number; max_free: number; min_free: number };
                return [
                  `avg ${p.avg_free}/${totalMembers} · range ${p.min_free}–${p.max_free}`,
                  "free closers",
                ];
              }}
            />
            <ReferenceLine
              y={overallAvg}
              stroke="var(--muted-foreground)"
              strokeDasharray="4 4"
              label={{
                value: `range avg ${overallAvg.toFixed(1)}`,
                position: "insideTopRight",
                fill: "var(--muted-foreground)",
                fontSize: 10,
              }}
            />
            <Area
              type="monotone"
              dataKey="avg_free"
              stroke="var(--nmm-green)"
              strokeWidth={2}
              fill="url(#todGrad)"
              dot={false}
              activeDot={{ r: 4, fill: "var(--nmm-green)" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

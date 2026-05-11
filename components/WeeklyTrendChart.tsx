"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { DailyAvailability } from "@/lib/availability";

export function WeeklyTrendChart({
  data,
  totalMembers,
  durationMin,
  tz,
}: {
  data: DailyAvailability[];
  totalMembers: number;
  durationMin: number;
  tz: string;
}) {
  if (data.length === 0) return null;

  const fmt = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: tz,
  });

  const chartData = data.map((d) => {
    const dt = new Date(d.date + "T12:00:00Z");
    return {
      day: fmt.format(dt),
      avg_free: Number(d.avg_free_per_slot.toFixed(2)),
      max_free: d.max_free,
      slot_count: d.slot_count,
      fully_booked: d.fully_booked,
    };
  });

  const overallAvg =
    data.reduce((s, d) => s + d.avg_free_per_slot, 0) / data.length;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Next {data.length} days
          </p>
          <h3 className="mt-1 font-heading text-lg font-semibold">
            Average teammates free in {durationMin}-min slots, by day
          </h3>
          <p className="mt-1 text-[11px] text-muted-foreground">
            higher = easier day to schedule a {durationMin}-minute call
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            week avg
          </p>
          <p className="font-heading text-xl font-semibold tabular-nums text-accent">
            {overallAvg.toFixed(1)} / {totalMembers}
          </p>
        </div>
      </div>

      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 16, left: 0, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="day"
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              interval={0}
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
              formatter={(v, key, item) => {
                if (key === "avg_free") {
                  const payload = item.payload as {
                    avg_free: number;
                    max_free: number;
                    slot_count: number;
                    fully_booked: number;
                  };
                  return [
                    `${payload.avg_free} / ${totalMembers} avg · max ${payload.max_free} · ${payload.fully_booked}/${payload.slot_count} fully booked`,
                    "free per slot",
                  ];
                }
                return [String(v), String(key)];
              }}
            />
            <ReferenceLine
              y={overallAvg}
              stroke="var(--muted-foreground)"
              strokeDasharray="4 4"
              label={{
                value: `week avg ${overallAvg.toFixed(1)}`,
                position: "insideTopRight",
                fill: "var(--muted-foreground)",
                fontSize: 10,
              }}
            />
            <Bar dataKey="avg_free" fill="var(--nmm-green)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Row } from "../lib/types";

const TZ = "America/New_York";
const fmtDateKey = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const fmtLabel = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  month: "short",
  day: "numeric",
});

// Stacked-bar daily volume: active vs canceled per day (ET). Skips empty
// days so a sparse range doesn't render as a wall of zero bars.
export function DailyVolumeChart({ rows }: { rows: Row[] }) {
  const data = useMemo(() => {
    const buckets = new Map<string, { active: number; canceled: number }>();
    for (const r of rows) {
      const d = new Date(r.startTime);
      if (Number.isNaN(d.getTime())) continue;
      const k = fmtDateKey.format(d);
      const cur = buckets.get(k) ?? { active: 0, canceled: 0 };
      if (r.status === "canceled") cur.canceled++;
      else cur.active++;
      buckets.set(k, cur);
    }
    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date,
        label: fmtLabel.format(new Date(date + "T12:00:00Z")),
        active: v.active,
        canceled: v.canceled,
        total: v.active + v.canceled,
      }));
  }, [rows]);

  if (data.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        Daily volume
      </p>
      <h3 className="mt-1 font-heading text-base font-semibold">
        Calls per day (ET)
      </h3>
      <div className="mt-4 h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              interval="preserveStartEnd"
              minTickGap={20}
              angle={-20}
              textAnchor="end"
              height={48}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              width={32}
            />
            <Tooltip
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              iconSize={10}
            />
            <Bar
              dataKey="active"
              stackId="status"
              name="Active"
              fill="var(--nmm-green)"
              radius={[0, 0, 0, 0]}
            >
              <LabelList
                dataKey="active"
                position="center"
                formatter={(v) => (typeof v === "number" && v > 0 ? String(v) : "")}
                style={{ fill: "#fff", fontSize: 10, fontWeight: 700 }}
              />
            </Bar>
            <Bar
              dataKey="canceled"
              stackId="status"
              name="Canceled"
              fill="#dc2626"
              radius={[4, 4, 0, 0]}
            >
              <LabelList
                dataKey="canceled"
                position="center"
                formatter={(v) => (typeof v === "number" && v > 0 ? String(v) : "")}
                style={{ fill: "#fff", fontSize: 10, fontWeight: 700 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

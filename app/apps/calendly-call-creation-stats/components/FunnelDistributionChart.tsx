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

// Horizontal stacked bar of bookings per funnel (internal_note).
// Sorted by total descending so the highest-volume funnels top the chart.
// Mirrors HostDistributionChart's visual treatment so the row reads as one
// pair of "who/where" breakdowns.
export function FunnelDistributionChart({ rows }: { rows: Row[] }) {
  const data = useMemo(() => {
    const map = new Map<string, { funnel: string; active: number; canceled: number }>();
    for (const r of rows) {
      const key = (r.internalNote || "—").trim() || "—";
      const cur = map.get(key) ?? { funnel: key, active: 0, canceled: 0 };
      if (r.status === "canceled") cur.canceled++;
      else cur.active++;
      map.set(key, cur);
    }
    return [...map.values()]
      .map((d) => ({ ...d, total: d.active + d.canceled }))
      .sort((a, b) => b.total - a.total);
  }, [rows]);

  if (data.length === 0) return null;
  const height = Math.max(160, data.length * 32 + 60);

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        Funnel distribution
      </p>
      <h3 className="mt-1 font-heading text-base font-semibold">
        Calls per funnel
      </h3>
      <div className="mt-4 w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 32, left: 16, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
            <XAxis
              type="number"
              allowDecimals={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
            />
            <YAxis
              type="category"
              dataKey="funnel"
              tick={{ fill: "var(--foreground)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              width={150}
            />
            <Tooltip
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconSize={10} />
            <Bar dataKey="active" stackId="s" name="Active" fill="var(--nmm-green)">
              <LabelList
                dataKey="active"
                position="center"
                formatter={(v) => (typeof v === "number" && v > 0 ? String(v) : "")}
                style={{ fill: "#fff", fontSize: 10, fontWeight: 700 }}
              />
            </Bar>
            <Bar dataKey="canceled" stackId="s" name="Canceled" fill="#dc2626">
              <LabelList
                dataKey="canceled"
                position="center"
                formatter={(v) => (typeof v === "number" && v > 0 ? String(v) : "")}
                style={{ fill: "#fff", fontSize: 10, fontWeight: 700 }}
              />
              <LabelList
                dataKey="total"
                position="right"
                style={{ fill: "var(--foreground)", fontSize: 11, fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

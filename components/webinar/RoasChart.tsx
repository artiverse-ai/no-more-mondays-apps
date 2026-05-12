"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { WebinarEvent } from "@/lib/webinar";
import { ChartCard } from "./ChartCard";
import {
  AXIS_LINE,
  AXIS_TICK,
  TOOLTIP_CONTENT_STYLE,
  TOOLTIP_LABEL_STYLE,
  fmt,
} from "./format";

export function RoasChart({ rows }: { rows: WebinarEvent[] }) {
  const data = [...rows]
    .sort((a, b) => a.webinar_date.localeCompare(b.webinar_date))
    .map((r) => ({ label: fmt.dateShort(r.webinar_date), roas: r.roas_cash }));

  return (
    <ChartCard title="ROAS (cash / spend)" subtitle="dashed line = break-even (1.0x)">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={AXIS_LINE}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={AXIS_LINE}
            width={36}
            tickFormatter={(v) => `${Number(v).toFixed(1)}x`}
          />
          <Tooltip
            contentStyle={TOOLTIP_CONTENT_STYLE}
            labelStyle={TOOLTIP_LABEL_STYLE}
            formatter={(value) => [
              value == null ? "—" : fmt.ratio(Number(value)),
              "ROAS",
            ]}
          />
          <ReferenceLine y={1} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
          <Line
            type="monotone"
            dataKey="roas"
            stroke="var(--chart-3)"
            strokeWidth={2}
            dot={{ r: 2 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

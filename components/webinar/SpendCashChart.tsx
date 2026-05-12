"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
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

const LABELS: Record<string, string> = {
  spend: "Ad spend",
  cash: "Cash collected",
};

export function SpendCashChart({ rows }: { rows: WebinarEvent[] }) {
  const data = [...rows]
    .sort((a, b) => a.webinar_date.localeCompare(b.webinar_date))
    .map((r) => ({
      label: fmt.dateShort(r.webinar_date),
      spend: r.ad_spend ?? 0,
      cash: r.cash_collected ?? 0,
    }));

  return (
    <ChartCard title="Ad spend & cash collected" subtitle="per webinar, over time">
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
            width={52}
            tickFormatter={(v) => fmt.compactMoney(Number(v))}
          />
          <Tooltip
            contentStyle={TOOLTIP_CONTENT_STYLE}
            labelStyle={TOOLTIP_LABEL_STYLE}
            formatter={(value, name) => [
              fmt.money(Number(value)),
              LABELS[String(name)] ?? String(name),
            ]}
          />
          <Legend
            wrapperStyle={{ fontSize: 11 }}
            formatter={(value) => LABELS[String(value)] ?? String(value)}
          />
          <Line
            type="monotone"
            dataKey="spend"
            stroke="var(--chart-3)"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="cash"
            stroke="var(--nmm-green)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

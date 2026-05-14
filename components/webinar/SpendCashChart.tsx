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

import type { WebinarPoint } from "@/lib/webinar";
import { ChartCard } from "./ChartCard";
import {
  AXIS_LINE,
  AXIS_TICK,
  TOOLTIP_CONTENT_STYLE,
  TOOLTIP_LABEL_STYLE,
  fmt,
} from "./format";

const LABELS: Record<string, string> = {
  spend: "Webinar Ad Spend",
  cash: "Cash collected",
};

export function SpendCashChart({
  points,
  subtitle = "per webinar, over time",
}: {
  points: WebinarPoint[];
  subtitle?: string;
}) {
  const data = points.map((p) => ({
    label: p.label,
    spend: p.total_webinar_ad_spend,
    cash: p.cash_collected,
  }));

  return (
    <ChartCard title="Webinar ad spend & cash collected" subtitle={subtitle}>
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

"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartCard } from "@/components/webinar/ChartCard";
import {
  AXIS_LINE,
  AXIS_TICK,
  TOOLTIP_CONTENT_STYLE,
  TOOLTIP_LABEL_STYLE,
  fmt,
} from "@/components/webinar/format";
import type { HighLevelDay } from "@/lib/highLevel";

const LABELS: Record<string, string> = {
  spend: "Ad spend",
  cash: "Cash collected",
};

export function DailyTrendChart({ days }: { days: HighLevelDay[] }) {
  const data = days.map((d) => ({
    label: fmt.dateShort(d.metric_date),
    spend: d.total_ad_spend ?? 0,
    cash: d.total_cash_collected ?? 0,
  }));

  return (
    <ChartCard
      title="Daily ad spend & cash collected"
      subtitle="all-campaign spend (date_closed for cash)"
      height="h-72"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={AXIS_LINE}
            interval="preserveStartEnd"
            minTickGap={28}
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
          <Bar dataKey="spend" fill="var(--chart-3)" radius={[3, 3, 0, 0]} />
          <Bar dataKey="cash" fill="var(--nmm-green)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

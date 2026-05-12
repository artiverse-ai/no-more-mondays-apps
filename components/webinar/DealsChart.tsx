"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
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

export function DealsChart({ rows }: { rows: WebinarEvent[] }) {
  const data = [...rows]
    .sort((a, b) => a.webinar_date.localeCompare(b.webinar_date))
    .map((r) => ({ label: fmt.dateShort(r.webinar_date), deals: r.deals_closed ?? 0 }));

  return (
    <ChartCard title="Deals closed per webinar">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 4 }}>
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
            allowDecimals={false}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={AXIS_LINE}
            width={28}
          />
          <Tooltip
            contentStyle={TOOLTIP_CONTENT_STYLE}
            labelStyle={TOOLTIP_LABEL_STYLE}
            formatter={(value) => [
              `${Number(value)} deal${Number(value) === 1 ? "" : "s"}`,
              "",
            ]}
          />
          <Bar dataKey="deals" fill="var(--chart-2)" radius={[4, 4, 0, 0]}>
            <LabelList
              dataKey="deals"
              position="top"
              style={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

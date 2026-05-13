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

import type { WebinarPoint } from "@/lib/webinar";
import { ChartCard } from "./ChartCard";
import {
  AXIS_LINE,
  AXIS_TICK,
  TOOLTIP_CONTENT_STYLE,
  TOOLTIP_LABEL_STYLE,
} from "./format";

export function DealsChart({
  points,
  title = "Deals closed",
}: {
  points: WebinarPoint[];
  title?: string;
}) {
  const data = points.map((p) => ({ label: p.label, deals: p.deals_closed }));

  return (
    <ChartCard title={title}>
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

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

import type { FunnelStage } from "@/lib/webinar";
import { ChartCard } from "./ChartCard";
import {
  AXIS_LINE,
  AXIS_TICK,
  TOOLTIP_CONTENT_STYLE,
  TOOLTIP_LABEL_STYLE,
  fmt,
} from "./format";

type Datum = {
  label: string;
  value: number;
  prevLabel: string | null;
  pctOfPrev: number | null;
};

export function FunnelChart({
  stages,
  title = "Funnel",
  subtitle,
  height = "h-72",
}: {
  stages: FunnelStage[];
  title?: string;
  subtitle?: string;
  height?: string;
}) {
  const data: Datum[] = stages.map((s, i) => {
    const prev = i === 0 ? null : stages[i - 1];
    return {
      label: s.label,
      value: s.value,
      prevLabel: prev ? prev.label : null,
      pctOfPrev: prev && prev.value > 0 ? s.value / prev.value : null,
    };
  });

  return (
    <ChartCard title={title} subtitle={subtitle} height={height}>
      {data.length === 0 ? (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          No funnel data for this selection.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={data}
            margin={{ top: 4, right: 56, left: 8, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
            <XAxis
              type="number"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={AXIS_LINE}
              tickFormatter={(v) => fmt.int(Number(v))}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={92}
              tick={{ fill: "var(--foreground)", fontSize: 11 }}
              tickLine={false}
              axisLine={AXIS_LINE}
            />
            <Tooltip
              contentStyle={TOOLTIP_CONTENT_STYLE}
              labelStyle={TOOLTIP_LABEL_STYLE}
              formatter={(value, _name, item) => {
                const p = (item?.payload ?? {}) as Partial<Datum>;
                const base = fmt.int(Number(value));
                return [
                  p.pctOfPrev != null
                    ? `${base}  ·  ${(p.pctOfPrev * 100).toFixed(1)}% of ${p.prevLabel}`
                    : base,
                  "",
                ];
              }}
            />
            <Bar dataKey="value" fill="var(--chart-1)" radius={[0, 4, 4, 0]}>
              <LabelList
                dataKey="value"
                position="right"
                style={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

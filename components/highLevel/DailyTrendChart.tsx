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
import type { HighLevelDay, TrendGranularity } from "@/lib/highLevel";

const LABELS: Record<string, string> = {
  spend: "Ad spend",
  cash: "Cash collected",
};

function formatBucketLabel(metricDate: string, gran: TrendGranularity): string {
  const dt = new Date(metricDate + "T00:00:00Z");
  if (gran === "year") {
    return dt.toLocaleDateString("en-US", { year: "numeric", timeZone: "UTC" });
  }
  if (gran === "month") {
    return dt.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  }
  // day / week — both use "May 3" (week shows Sunday-start)
  return fmt.dateShort(metricDate);
}

const TITLE: Record<TrendGranularity, string> = {
  day: "Daily ad spend & cash collected",
  week: "Weekly ad spend & cash collected",
  month: "Monthly ad spend & cash collected",
  year: "Yearly ad spend & cash collected",
};

const SUBTITLE: Record<TrendGranularity, string> = {
  day: "all-campaign spend, summed per day",
  week: "summed per Sunday-anchored week",
  month: "summed per calendar month",
  year: "summed per calendar year",
};

export function DailyTrendChart({
  days,
  gran = "day",
}: {
  days: HighLevelDay[];
  gran?: TrendGranularity;
}) {
  const data = days.map((d) => ({
    label: formatBucketLabel(d.metric_date, gran),
    spend: d.total_ad_spend ?? 0,
    cash: d.total_cash_collected ?? 0,
  }));

  return (
    <ChartCard
      title={TITLE[gran]}
      subtitle={SUBTITLE[gran]}
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

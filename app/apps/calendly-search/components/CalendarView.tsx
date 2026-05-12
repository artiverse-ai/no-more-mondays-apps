"use client";

import { CalendlyEventType, Row } from "../lib/types";
import { CallHeatMatrix } from "./CallHeatMatrix";
import { DailyVolumeChart } from "./DailyVolumeChart";
import { HostDistributionChart } from "./HostDistributionChart";
import { MatchedPills } from "./MatchedPills";

// Visual view of the same filtered rows the tables show: heatmap (the
// primary calendar grid) on top, then daily volume + host distribution as
// supporting charts. Numbers are clickable in the heatmap.
export function CalendarView({
  rows,
  matchedEventTypes,
  onInspect,
}: {
  rows: Row[];
  matchedEventTypes: CalendlyEventType[];
  onInspect: (id: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="overflow-hidden rounded-xl border border-border">
        <MatchedPills types={matchedEventTypes} />
        <div className="px-4 py-12 text-center text-sm text-muted-foreground">
          No calls match current filters
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-border">
        <MatchedPills types={matchedEventTypes} />
      </div>

      <CallHeatMatrix rows={rows} onInspect={onInspect} />

      <div className="grid gap-4 lg:grid-cols-2">
        <DailyVolumeChart rows={rows} />
        <HostDistributionChart rows={rows} />
      </div>
    </div>
  );
}

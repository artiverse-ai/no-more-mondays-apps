import { DashboardSkeleton } from "@/components/ui/dashboard-skeleton";

// Route-level fallback for /dashboards/sales while server BigQuery
// queries are in flight. Matches the eventual Overview tab layout:
// hero strip + filter bar + 13-cell KPI strip + funnel-count row +
// dollars-per-prospect chart + closer leaderboard.
export default function Loading() {
  return (
    <DashboardSkeleton
      sections={["hero", "filterBar", "kpiStrip", "chart", "table"]}
      kpis={13}
      rows={10}
    />
  );
}

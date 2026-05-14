import { DashboardSkeleton } from "@/components/ui/dashboard-skeleton";

// Webinar overview skeleton — hero + filters + KPI strip + funnel +
// per-webinar table.
export default function Loading() {
  return (
    <DashboardSkeleton
      sections={["hero", "filterBar", "kpiStrip", "funnel", "table"]}
      kpis={9}
      rows={8}
    />
  );
}

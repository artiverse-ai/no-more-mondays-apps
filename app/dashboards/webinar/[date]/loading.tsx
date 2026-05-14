import { DashboardSkeleton } from "@/components/ui/dashboard-skeleton";

// Webinar drill-in skeleton — single-webinar KPI cluster, funnel
// visualization, and the calls table beneath.
export default function Loading() {
  return (
    <DashboardSkeleton
      sections={["hero", "kpiStrip", "funnel", "filterBar", "table"]}
      kpis={8}
      rows={12}
    />
  );
}

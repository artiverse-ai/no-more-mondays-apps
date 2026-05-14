import { DashboardSkeleton } from "@/components/ui/dashboard-skeleton";

// Setter dashboard skeleton — mirrors Sales but with the setter-emphasis
// 8-cell KPI strip.
export default function Loading() {
  return (
    <DashboardSkeleton
      sections={["hero", "filterBar", "kpiStrip", "chart", "table"]}
      kpis={8}
      rows={10}
    />
  );
}

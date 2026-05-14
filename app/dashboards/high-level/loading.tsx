import { DashboardSkeleton } from "@/components/ui/dashboard-skeleton";

// CEO dashboard skeleton — hero + period filter + KPI strip + chart +
// per-person rollup table.
export default function Loading() {
  return (
    <DashboardSkeleton
      sections={["hero", "filterBar", "kpiStrip", "chart", "table"]}
      kpis={10}
      rows={6}
    />
  );
}

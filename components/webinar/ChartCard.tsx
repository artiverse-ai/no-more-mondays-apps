import { cn } from "@/lib/utils";

export function ChartCard({
  title,
  subtitle,
  children,
  height = "h-64",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Tailwind height class for the chart area; the chart fills it. */
  height?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h3 className="font-heading text-sm font-semibold text-foreground">
        {title}
      </h3>
      {subtitle ? (
        <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>
      ) : null}
      <div className={cn("mt-4 w-full", height)}>{children}</div>
    </div>
  );
}

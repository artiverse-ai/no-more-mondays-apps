import { cn } from "@/lib/utils";

export function Kpi({
  label,
  value,
  sub,
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4 shadow-sm",
        className,
      )}
    >
      <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1.5 font-heading text-2xl font-semibold tabular-nums">
        {value}
      </div>
      {sub ? (
        <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div>
      ) : null}
    </div>
  );
}

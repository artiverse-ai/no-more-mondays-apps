import { cn } from "@/lib/utils";
import { InfoTip } from "@/components/ui/info-tip";

/**
 * KPI tile. Server component (no hooks).
 *
 * `size`:
 *   - "default" — secondary tiles in dense grids (the existing look).
 *   - "hero"    — primary tiles on the dashboard hero strip; bigger
 *                  numbers, more padding, soft elevation.
 *
 * Passing `metric` looks up `lib/metricDefs.ts` and renders an InfoTip
 * next to the label. `devMode` gates whether the SQL block shows.
 */
export function Kpi({
  label,
  value,
  sub,
  size = "default",
  metric,
  devMode = false,
  delta,
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  size?: "default" | "hero";
  /** Key into lib/metricDefs.ts. If present, adds an InfoTip beside the label. */
  metric?: string;
  /** When true, the InfoTip popover also shows SQL + source. */
  devMode?: boolean;
  /** Optional period-over-period delta (e.g. 0.123 = +12.3%). Rendered as
   *  a colored arrow + percentage on hero tiles. */
  delta?: number | null;
  className?: string;
}) {
  const isHero = size === "hero";
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card",
        isHero
          ? "p-5 shadow-[var(--shadow-card)]"
          : "p-4 shadow-sm",
        className,
      )}
    >
      <div className="flex items-center gap-1.5">
        <div
          className={cn(
            "text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground",
            isHero ? "text-[10.5px] tracking-[0.18em]" : "",
          )}
        >
          {label}
        </div>
        {metric ? <InfoTip metric={metric} devMode={devMode} size={12} /> : null}
      </div>

      <div
        className={cn(
          "font-heading font-semibold tabular-nums tracking-tight",
          isHero ? "mt-2 text-[2rem] leading-none md:text-[2.25rem]" : "mt-1.5 text-2xl",
        )}
      >
        {value}
      </div>

      <div className="mt-1 flex items-baseline gap-2 text-[11px] text-muted-foreground">
        {sub ? <span>{sub}</span> : null}
        {delta != null && Number.isFinite(delta) ? (
          <DeltaBadge value={delta} />
        ) : null}
      </div>
    </div>
  );
}

function DeltaBadge({ value }: { value: number }) {
  const positive = value >= 0;
  const pct = Math.abs(value * 100);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
        positive
          ? "bg-alert-green/12 text-alert-green"
          : "bg-alert-red/12 text-alert-red",
      )}
      title={`${positive ? "+" : "−"}${pct.toFixed(1)}% vs prior period`}
    >
      <span aria-hidden>{positive ? "↑" : "↓"}</span>
      {pct.toFixed(pct >= 10 ? 0 : 1)}%
    </span>
  );
}

"use client";

// Apple-style info-icon tooltip. Hovers (200ms open / 100ms close) and
// keyboard-focuses to reveal the metric definition in five layers:
//
//   1. label + description  (always — what the number means)
//   2. formula              (always — plain English calculation)
//   3. period               (always — what time slice it covers,
//                             e.g. "Across selected date range",
//                             "Single webinar event")
//   4. date dimension       (always — which column drives the period,
//                             e.g. "appointment_date_time", "date_closed",
//                             "webinar_date")
//   5. sql + source         (devMode only — for developers)
//
// When a MetricDef omits `period` / `dateDim`, sensible defaults are
// inferred from `source` (see `defaultPeriodFor` / `defaultDateDimFor`
// below). Override per-metric by setting them explicitly in
// `lib/metricDefs.ts`.
//
// Built on @base-ui/react/tooltip (hover-first, keyboard-accessible) to
// match the existing UI stack (components/ui/{button,badge,select}.tsx).
// Stays out of Radix.

import { InfoIcon } from "lucide-react";
import { Tooltip } from "@base-ui/react/tooltip";
import { cn } from "@/lib/utils";
import { getMetricDef, type MetricDef } from "@/lib/metricDefs";

type Props = {
  /** Key into METRIC_DEFS. Either this or `metricDef` is required. */
  metric?: string;
  /** Inline def — useful for derived/ad-hoc metrics that don't live in the registry. */
  metricDef?: MetricDef;
  /** When true, show the SQL + source rows. Source from `getDevMode()` in server pages. */
  devMode?: boolean;
  /** Extra className for the trigger button (e.g. size override). */
  className?: string;
  /** Override the trigger icon size. Default 14px (matches the surrounding text). */
  size?: number;
};

export function InfoTip({
  metric,
  metricDef,
  devMode = false,
  className,
  size = 14,
}: Props) {
  const def = metricDef ?? (metric ? getMetricDef(metric) : null);
  if (!def) {
    if (process.env.NODE_ENV !== "production" && metric) {
      // Loud-in-dev, silent-in-prod miss so we catch typos / unregistered keys.
      console.warn(`[InfoTip] no MetricDef registered for "${metric}"`);
    }
    return null;
  }

  const period = def.period ?? defaultPeriodFor(def);
  const dateDim = def.dateDim ?? defaultDateDimFor(def);

  return (
    // delay / closeDelay are set globally on <Tooltip.Provider> in
    // app/layout.tsx so adjacent tooltips share the group-instant
    // open behavior (Apple-feel hover-through across a row of icons).
    <Tooltip.Root>
      <Tooltip.Trigger
        aria-label={`Definition of ${def.label}`}
        className={cn(
          "inline-flex shrink-0 cursor-help items-center justify-center rounded-full text-muted-foreground/65 transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          className,
        )}
      >
        <InfoIcon style={{ width: size, height: size }} aria-hidden />
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={8} className="z-50">
          <Tooltip.Popup
            className={cn(
              "w-[min(22rem,calc(100vw-2rem))] origin-[var(--transform-origin)] rounded-xl bg-popover p-3.5 text-[12.5px] leading-relaxed text-popover-foreground outline-none",
              "shadow-[var(--shadow-elevated)]",
              "data-[instant]:duration-0",
              "data-[open]:animate-in data-[open]:fade-in-0 data-[open]:zoom-in-95",
              "data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:zoom-out-95",
            )}
            style={{ transitionTimingFunction: "var(--ease-out)" }}
          >
            <div className="text-[13px] font-semibold tracking-[-0.005em] text-foreground">
              {def.label}
            </div>
            <p className="mt-1 text-muted-foreground">{def.description}</p>

            <Section label="Formula">
              <p className="text-foreground">{def.formula}</p>
            </Section>

            <Section label="Period">
              <p className="text-foreground">{period}</p>
            </Section>

            {dateDim ? (
              <Section label="Date dimension">
                <code className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                  {dateDim}
                </code>
              </Section>
            ) : null}

            {devMode && def.sql ? (
              <Section label="SQL">
                <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-muted/60 p-2 font-mono text-[11px] leading-[1.45] text-foreground">
                  {def.sql}
                </pre>
                {def.source ? (
                  <p className="mt-1.5 text-[10.5px] text-muted-foreground">
                    source:{" "}
                    <code className="rounded bg-muted/60 px-1 py-0.5 font-mono">
                      {def.source}
                    </code>
                  </p>
                ) : null}
              </Section>
            ) : null}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-2.5 border-t border-border/60 pt-2.5">
      <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------
// Defaults inferred from the metric's source mart/view. Keeps every
// existing MetricDef working without an explicit `period` / `dateDim`
// until someone overrides them per-metric. Override priority: explicit
// fields on the MetricDef > these defaults.
// ---------------------------------------------------------------------

function defaultPeriodFor(def: MetricDef): string {
  const src = def.source ?? "";
  const key = def.key ?? "";
  if (src.includes("mart_webinar_events")) return "Single webinar event";
  if (src.includes("mart_high_level_daily")) return "Across selected date range";
  if (src.includes("int_closer_performance")) return "Across selected date range";
  if (src.includes("int_calls_enriched")) {
    if (key.startsWith("median_")) return "Deals closed in the selected range";
    return "Calls in the selected date range";
  }
  return "Across the selected date range";
}

function defaultDateDimFor(def: MetricDef): string {
  const src = def.source ?? "";
  const key = def.key ?? "";
  if (src.includes("mart_webinar_events")) return "webinar_date";
  if (src.includes("mart_high_level_daily")) return "metric_date";
  if (src.includes("int_closer_performance")) return "appt_date";
  if (src.includes("int_calls_enriched")) {
    if (key.startsWith("median_") || key.includes("roas") || key === "total_cash_collected" || key === "total_revenue_contracted" || key === "total_deals_closed" || key === "pif_rate" || key === "aov" || key === "acv") return "date_closed";
    return "appointment_date_time";
  }
  return "";
}

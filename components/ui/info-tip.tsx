"use client";

// Apple-style info-icon popover. Click or keyboard-focus opens a small
// popup that explains the metric in three layers:
//
//   1. label + description  (always — what the number means)
//   2. formula              (always — plain English calculation)
//   3. sql + source         (devMode only — for developers)
//
// Lookup-by-key from lib/metricDefs.ts keeps every label/formula in one
// source of truth. Passing `metricDef` directly is supported for one-off
// inline definitions (e.g. ad-hoc derived metrics inside a chart card).
//
// Built on @base-ui/react/popover to match the existing UI stack
// (components/ui/{button,badge,select}.tsx). Stays out of Radix.

import { InfoIcon } from "lucide-react";
import { Popover } from "@base-ui/react/popover";
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

  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={`Definition of ${def.label}`}
        className={cn(
          "inline-flex shrink-0 cursor-help items-center justify-center rounded-full text-muted-foreground/65 transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          className,
        )}
      >
        <InfoIcon style={{ width: size, height: size }} aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8} align="center" className="z-50">
          <Popover.Popup
            className={cn(
              "w-[min(20rem,calc(100vw-2rem))] origin-[var(--transform-origin)] rounded-xl bg-popover p-3.5 text-[12.5px] leading-relaxed text-popover-foreground outline-none",
              "shadow-[var(--shadow-elevated)]",
              "data-[open]:animate-in data-[open]:fade-in-0 data-[open]:zoom-in-95",
              "data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:zoom-out-95",
            )}
            // Smooth Apple-feel motion via our easing token.
            style={{ transitionTimingFunction: "var(--ease-out)" }}
          >
            <div className="text-[13px] font-semibold tracking-[-0.005em] text-foreground">
              {def.label}
            </div>
            <p className="mt-1 text-muted-foreground">{def.description}</p>

            <Section label="Formula">
              <p className="text-foreground">{def.formula}</p>
            </Section>

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
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
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

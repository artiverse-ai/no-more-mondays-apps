"use client";

import { CalendlyEventType } from "../lib/types";

export function MatchedPills({ types }: { types: CalendlyEventType[] }) {
  if (types.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
      {types.map((et) => {
        const kindLabel = et.pooling_type ?? et.kind ?? "solo";
        return (
          <span
            key={et.uri}
            className="rounded-md border border-accent/30 bg-accent/10 px-2.5 py-1 font-mono text-xs text-accent"
          >
            {et.name}
            <span className="ml-1.5 text-[10px] text-indigo-700">[{kindLabel}]</span>
            <span className="ml-1.5 text-muted-foreground">→ &ldquo;{et.internal_note || ""}&rdquo;</span>
          </span>
        );
      })}
    </div>
  );
}

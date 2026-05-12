"use client";

import { useState } from "react";
import { CalendlyEventType } from "../lib/types";

// Summary of the event types that matched the picked funnels. Hidden by
// default — with "All" selected the list is huge and dominates the page.
// Surfacing as a count + expand link keeps the table the main thing.
export function MatchedPills({ types }: { types: CalendlyEventType[] }) {
  const [open, setOpen] = useState(false);
  if (types.length === 0) return null;

  const noteCount = new Set(
    types.map((t) => (t.internal_note ?? "").trim()).filter(Boolean),
  ).size;

  return (
    <div className="border-b border-border bg-muted/40 px-4 py-2 text-[11px] text-muted-foreground">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="font-mono hover:text-foreground"
      >
        {open ? "▾" : "▸"} {types.length} event type{types.length === 1 ? "" : "s"} matched
        {noteCount > 0 ? ` across ${noteCount} funnel${noteCount === 1 ? "" : "s"}` : ""}
      </button>
      {open && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {types.map((et) => {
            const kindLabel = et.pooling_type ?? et.kind ?? "solo";
            return (
              <span
                key={et.uri}
                className="rounded-md border border-accent/30 bg-accent/10 px-2 py-0.5 font-mono text-[10px] text-accent"
                title={`internal_note: ${et.internal_note || ""}`}
              >
                {et.name}
                <span className="ml-1 text-indigo-700">[{kindLabel}]</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

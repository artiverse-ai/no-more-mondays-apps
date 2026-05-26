// BQ-backed search — replaces the 6-phase live-Calendly-API pipeline
// with a single call to /api/calendly-stats/search, which queries
// dbt_tuddin.stg_calendly (pre-joined event ⋈ invitee ⋈ event_type).
//
// Why we moved off the live API:
//   - 30-60s search → <2s (one BQ query vs. ~200 paginated API calls)
//   - No more "supplied parameters are invalid" flakes on /scheduled_events
//   - Pre-classified is_setter_booking / is_webinar_booking / setter_name
//
// Trade-offs we accept:
//   - Data is ~6h stale (Fivetran sync cadence). For "Today" / "Last 24h"
//     presets the most recent bookings may not appear until next sync.
//   - Multi-host round-robin events show only the primary assigned_rep —
//     stg_calendly collapses memberships. Secondary hosts on the ~5-10%
//     of round-robin events aren't visible. The original "all hosts"
//     join is preserved upstream in event_membership if we ever need it.

import {
  CalendlyEventType,
  DebugStats,
  Preset,
  PRESETS,
  PresetKey,
  Row,
  SearchProgress,
  SearchResult,
} from "./types";

export type SearchOptions = {
  notes: string[];
  /** When set, also require event_type.name to start with this prefix
   *  (case-insensitive). Layered ON TOP of the internal_note filter. */
  titlePrefix?: string | null;
  presetKey: PresetKey;
  customStart?: string;
  customEnd?: string;
  onProgress: (p: SearchProgress) => void;
  signal: AbortSignal;
};

type ApiResponse = {
  rows: Row[];
  matchedEventTypes: CalendlyEventType[];
  window: { start: string; end: string };
  debug: DebugStats;
};

export async function runSearch(opts: SearchOptions): Promise<SearchResult> {
  const startTime = Date.now();
  const tick = (message: string, pct: number, detail = "") => {
    opts.onProgress({
      message,
      pct,
      detail,
      apiCalls: 0,
      elapsedSec: (Date.now() - startTime) / 1000,
    });
  };

  const userRange = getUserDateRange(opts);
  tick("Querying BigQuery...", 10);

  const res = await fetch("/api/calendly-stats/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      notes: opts.notes,
      titlePrefix: opts.titlePrefix ?? null,
      start: userRange.start.toISOString(),
      end: userRange.end.toISOString(),
    }),
    signal: opts.signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }
  const data = (await res.json()) as ApiResponse;
  tick("Processing results...", 80);

  // Rebuild the rawById map the JsonModal expects. The route sends each
  // row with synthesized _event / _invitee / _eventType payloads so we
  // can hand the modal something to render even without a live API hit.
  const rawById: SearchResult["rawById"] = new Map();
  for (const row of data.rows) {
    rawById.set(row.id, {
      event: row._event,
      invitee: row._invitee,
      eventType: row._eventType,
    });
  }

  tick("Done", 100);
  return {
    rows: data.rows,
    matchedEventTypes: data.matchedEventTypes,
    debug: data.debug,
    window: data.window,
    rawById,
  };
}

function getActivePreset(presetKey: PresetKey): Preset {
  return PRESETS.find((p) => p.key === presetKey) || PRESETS.find((p) => p.key === "last7d")!;
}

function getUserDateRange(opts: SearchOptions): { start: Date; end: Date } {
  const preset = getActivePreset(opts.presetKey);
  if (preset.direction === "custom") {
    return {
      start: new Date((opts.customStart || "") + "T00:00:00"),
      end: new Date((opts.customEnd || "") + "T23:59:59"),
    };
  }
  const now = new Date();
  const ms = (preset.amount ?? 0) * (preset.unit === "hours" ? 3600000 : 86400000);
  return { start: new Date(now.getTime() - ms), end: now };
}

// The search pipeline. Booking-time mode and rescheduled-link reconciliation
// were removed when the UI consolidated on call-time semantics. runSearch()
// now drives 6 phases:
//   1. /users/me                                      → org URI
//   2. /organization_memberships                      → all user URIs
//   3. /event_types?user=<each> (parallel)            → all event types
//   4. local filter: internal_note ∈ wanted set       → matched types
//   5. /scheduled_events?status=active,canceled       → events (org-wide,
//                                                       windowed by start_time)
//   6. /scheduled_events/<uuid>/invitees (parallel)   → invitee rows
//
// All fan-outs use a shared-cursor pool of 8 workers. The proxy at
// /api/calendly forwards the CALENDLY_PAT — the browser never sees it.

import {
  CalendlyEventType,
  CalendlyInvitee,
  CalendlyScheduledEvent,
  DebugStats,
  Preset,
  PRESETS,
  PresetKey,
  Row,
  SearchProgress,
  SearchResult,
} from "./types";

const CONCURRENCY = 8;
const API_BASE = "/api/calendly";

export type SearchOptions = {
  notes: string[];
  presetKey: PresetKey;
  customStart?: string;
  customEnd?: string;
  onProgress: (p: SearchProgress) => void;
  signal: AbortSignal;
};

export async function runSearch(opts: SearchOptions): Promise<SearchResult> {
  const startTime = Date.now();
  let apiCalls = 0;

  const tick = (message: string, pct: number, detail = "") => {
    opts.onProgress({
      message,
      pct,
      detail,
      apiCalls,
      elapsedSec: (Date.now() - startTime) / 1000,
    });
  };

  const apiFetch = async <T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> => {
    if (opts.signal.aborted) throw new DOMException("Aborted", "AbortError");
    apiCalls++;
    const url = new URL(API_BASE + path, window.location.origin);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
    const res = await fetch(url.toString(), { signal: opts.signal });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || `Proxy error ${res.status}`);
    }
    return res.json() as Promise<T>;
  };

  const fetchAllPages = async <T>(
    path: string,
    params: Record<string, string | number | undefined> = {},
  ): Promise<T[]> => {
    const all: T[] = [];
    let nextToken: string | null = null;
    do {
      const p: Record<string, string | number | undefined> = { ...params, count: 100 };
      if (nextToken) p.page_token = nextToken;
      const data: { collection?: T[]; pagination?: { next_page_token?: string | null } } = await apiFetch(path, p);
      all.push(...(data.collection || []));
      nextToken = data.pagination?.next_page_token || null;
    } while (nextToken);
    return all;
  };

  const runWithConcurrency = async <In, Out>(
    items: In[],
    taskFn: (item: In, i: number) => Promise<Out>,
    onProgress?: (done: number, total: number, item: In) => void,
  ): Promise<Out[]> => {
    const total = items.length;
    if (total === 0) return [];
    const results = new Array<Out>(total);
    let nextIndex = 0;
    let completed = 0;
    const worker = async () => {
      while (true) {
        if (opts.signal.aborted) return;
        const i = nextIndex++;
        if (i >= total) return;
        try {
          results[i] = await taskFn(items[i], i);
        } catch (e) {
          results[i] = ({ __error: (e as Error).message } as unknown) as Out;
        }
        completed++;
        onProgress?.(completed, total, items[i]);
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total) }, worker));
    return results;
  };

  // ----- Phases -----

  const debug: DebugStats = {
    eventTypesScanned: 0,
    matchedTypes: 0,
    eventsFetched: 0,
    activeFetched: 0,
    canceledFetched: 0,
    finalRows: 0,
  };
  const rawById: SearchResult["rawById"] = new Map();

  // Phase 1
  tick("Authenticating...", 2);
  const me = await apiFetch<{ resource: { current_organization?: string } }>("/users/me");
  const orgUri = me.resource?.current_organization;
  if (!orgUri) throw new Error("Could not resolve organization URI. Verify your PAT has admin scope.");

  // Phase 2
  tick("Fetching organization members...", 5);
  const memberships = await fetchAllPages<{ user?: { uri?: string } | string }>(
    "/organization_memberships",
    { organization: orgUri },
  );
  const userUris: string[] = memberships
    .map((m) => {
      if (typeof m.user === "string") return m.user;
      return m.user?.uri ?? null;
    })
    .filter((u): u is string => Boolean(u));
  if (userUris.length === 0) throw new Error("No users found in organization.");

  // Phase 3 — per-user event types in parallel
  tick(`Scanning event types across ${userUris.length} users...`, 8);
  const seenUris = new Set<string>();
  const allEventTypes: CalendlyEventType[] = [];

  await runWithConcurrency(
    userUris,
    async (userUri) => {
      try {
        const userEts = await fetchAllPages<CalendlyEventType>("/event_types", { user: userUri });
        for (const et of userEts) {
          if (et.deleted_at) continue;
          if (!seenUris.has(et.uri)) {
            seenUris.add(et.uri);
            allEventTypes.push(et);
          }
        }
      } catch {
        /* per-user failures are tolerated */
      }
    },
    (done, total) => {
      const pct = 8 + Math.round((done / total) * 14);
      tick(`Scanning event types (${done}/${total} users)`, pct);
    },
  );

  // Phase 4 — match by internal_note. Discrete set from the picker.
  const wanted = new Set(opts.notes.map((n) => n.trim().toLowerCase()));
  const matchedTypes = allEventTypes.filter((et) => {
    const n = (et.internal_note ?? "").trim().toLowerCase();
    return n.length > 0 && wanted.has(n);
  });
  debug.eventTypesScanned = allEventTypes.length;
  debug.matchedTypes = matchedTypes.length;

  const matchedTypeByUri = new Map(matchedTypes.map((t) => [t.uri, t]));

  if (matchedTypes.length === 0) {
    return { rows: [], matchedEventTypes: [], debug, rawById };
  }

  tick(
    `Matched ${matchedTypes.length} event type${matchedTypes.length === 1 ? "" : "s"} of ${allEventTypes.length} total`,
    25,
  );

  // Phase 5 — fetch scheduled events org-wide, filter locally by event_type
  const userRange = getUserDateRange(opts);

  type Candidate = {
    event: CalendlyScheduledEvent;
    eventType: CalendlyEventType;
  };
  const eventMap = new Map<string, Candidate>();

  const statuses: ("active" | "canceled")[] = ["active", "canceled"];

  await runWithConcurrency(
    statuses,
    async (status) => {
      const events = await fetchAllPages<CalendlyScheduledEvent>("/scheduled_events", {
        organization: orgUri,
        min_start_time: userRange.start.toISOString(),
        max_start_time: userRange.end.toISOString(),
        status,
        sort: "start_time:desc",
      });
      for (const ev of events) {
        if (eventMap.has(ev.uri)) continue;
        const et = matchedTypeByUri.get(ev.event_type);
        if (!et) continue;

        if (ev.status === "canceled") debug.canceledFetched++;
        else debug.activeFetched++;

        eventMap.set(ev.uri, { event: ev, eventType: et });
      }
    },
    (done, total, status) => {
      const pct = 25 + Math.round((done / total) * 30);
      tick(`Fetching ${status} events (${done}/${total})`, pct);
    },
  );

  const candidates = Array.from(eventMap.values());
  debug.eventsFetched = candidates.length;
  if (candidates.length === 0) {
    return { rows: [], matchedEventTypes: matchedTypes, debug, rawById };
  }

  // Phase 6 — invitees per event in parallel
  tick(`Resolving ${candidates.length} bookings...`, 56);
  const rows: Row[] = [];

  await runWithConcurrency(
    candidates,
    async ({ event, eventType }) => {
      const path = event.uri.replace("https://api.calendly.com", "");
      const invitees = await fetchAllPages<CalendlyInvitee>(path + "/invitees");

      const memberships = event.event_memberships || [];
      const primary = memberships[0] || {};
      const hostNames = memberships.map((m) => m.user_name).filter((x): x is string => Boolean(x));
      const hostEmails = memberships.map((m) => m.user_email).filter((x): x is string => Boolean(x));
      const allHostNames = hostNames.join(", ");
      const allHostEmails = hostEmails.join(", ");

      for (const inv of invitees) {
        const row: Row = {
          id: inv.uri,
          eventUri: event.uri,
          inviteeName: inv.name || "—",
          inviteeEmail: (inv.email || "").toLowerCase(),
          inviteeEmailDisplay: inv.email || "—",
          status:
            inv.status === "canceled" || event.status === "canceled" ? "canceled" : "active",
          eventName: event.name || "—",
          eventTypeName: eventType.name || "—",
          eventTypeKind: eventType.kind || "—",
          eventTypePooling: eventType.pooling_type || null,
          internalNote: eventType.internal_note || "",
          hostName: primary.user_name || "—",
          hostEmail: primary.user_email || "",
          hostNames,
          hostEmails,
          allHosts: allHostNames || primary.user_name || "",
          allHostEmails: allHostEmails || primary.user_email || "",
          hostCount: memberships.length || 0,
          startTime: event.start_time,
          endTime: event.end_time,
          createdAt: inv.created_at || event.created_at,
          cancelReason: inv.cancellation?.reason || event.cancellation?.reason || null,
          timezone: inv.timezone || null,
          location: event.location?.location || event.location?.join_url || null,
          oldInvitee: inv.old_invitee || null,
          newInvitee: inv.new_invitee || null,
          rescheduled: Boolean(inv.rescheduled),
          _event: event,
          _invitee: inv,
          _eventType: eventType,
        };
        rows.push(row);
        rawById.set(row.id, { event, invitee: inv, eventType });
      }
    },
    (done, total) => {
      const pct = 56 + Math.round((done / total) * 44);
      tick(`Resolving bookings (${done}/${total})`, pct);
    },
  );

  debug.finalRows = rows.length;

  tick("Done", 100);
  return { rows, matchedEventTypes: matchedTypes, debug, rawById };
}

function getActivePreset(presetKey: PresetKey): Preset {
  return PRESETS.find((p) => p.key === presetKey) || PRESETS.find((p) => p.key === "last7d")!;
}

// 5 years out — Calendly requires a max_start_time, so "future" still needs
// an upper bound. Bookings further out than 5 years aren't a realistic case.
const FUTURE_HORIZON_MS = 5 * 365 * 86400000;

function getUserDateRange(opts: SearchOptions): { start: Date; end: Date } {
  const preset = getActivePreset(opts.presetKey);
  if (preset.direction === "custom") {
    return {
      start: new Date((opts.customStart || "") + "T00:00:00"),
      end: new Date((opts.customEnd || "") + "T23:59:59"),
    };
  }
  const now = new Date();
  if (preset.direction === "all-future") {
    return { start: now, end: new Date(now.getTime() + FUTURE_HORIZON_MS) };
  }
  const ms = (preset.amount ?? 0) * (preset.unit === "hours" ? 3600000 : 86400000);
  if (preset.direction === "future") {
    return { start: now, end: new Date(now.getTime() + ms) };
  }
  return { start: new Date(now.getTime() - ms), end: now };
}

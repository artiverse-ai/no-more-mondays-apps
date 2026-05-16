// The search pipeline — CREATION-TIME flavour of the original Funnel Search.
// This app filters by event.created_at (when the booking was made) instead
// of event.start_time (when the call is scheduled). Calendly's API only
// supports start_time as a server-side filter, so we fetch a wide
// start_time window and drop anything whose created_at falls outside the
// user's chosen creation window.
//
// runSearch() drives 6 phases:
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
  /** When set, also require event_type.name to start with this prefix
   *  (case-insensitive). Layered ON TOP of the internal_note filter. */
  titlePrefix?: string | null;
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
    // 30s per-request timeout — without this a single slow/hung Calendly
    // response keeps a runWithConcurrency worker blocked forever (e.g. the
    // search stalled at "21/23 users" because two event_types fetches
    // hung).
    const timeoutSig = AbortSignal.timeout(30_000);
    const sig = AbortSignal.any([opts.signal, timeoutSig]);
    let res: Response;
    try {
      res = await fetch(url.toString(), { signal: sig });
    } catch (e) {
      if (timeoutSig.aborted && !opts.signal.aborted) {
        throw new Error(`Timeout after 30s [${url.search.slice(1)}]`);
      }
      throw e;
    }
    if (!res.ok) {
      // Calendly returns { title, message, details: [{ parameter, message }] }.
      // Surface all of it so we know exactly which param it rejected.
      const errBody: {
        title?: string;
        message?: string;
        error?: string;
        details?: Array<{ parameter?: string; message?: string }>;
      } = await res.json().catch(() => ({}));
      const headline = errBody.message || errBody.error || errBody.title || `HTTP ${res.status}`;
      const detailsStr =
        errBody.details && errBody.details.length > 0
          ? " · " +
            errBody.details
              .map((d) => `${d.parameter ?? "?"}: ${d.message ?? ""}`)
              .join("; ")
          : "";
      const queryStr = url.search.length > 1 ? url.search.slice(1) : "";
      throw new Error(`${headline}${detailsStr} [${queryStr}]`);
    }
    return res.json() as Promise<T>;
  };

  const fetchAllPages = async <T>(
    path: string,
    params: Record<string, string | number | undefined> = {},
  ): Promise<T[]> => {
    // Pagination uses pagination.next_page (a full URL) rather than just
    // next_page_token. The token is tied to Calendly's internal
    // microsecond-precision normalization of the filter params, so
    // reconstructing the request ourselves (even with the same params we
    // sent on page 1) yields "page_token: is invalid". The next_page URL
    // contains the canonical params Calendly expects — including
    // microsecond-precision timestamps — so we just follow it.
    const all: T[] = [];
    let nextPath: string = path;
    let nextParams: Record<string, string | number | undefined> = { ...params, count: 100 };
    let nextPageUrl: string | null = null;
    while (true) {
      const data: {
        collection?: T[];
        pagination?: { next_page?: string | null; next_page_token?: string | null };
      } = await apiFetch(nextPath, nextParams);
      all.push(...(data.collection || []));
      nextPageUrl = data.pagination?.next_page || null;
      if (!nextPageUrl) break;
      // Parse the next_page URL into (path, params) for the next call.
      try {
        const u = new URL(nextPageUrl);
        nextPath = u.pathname; // e.g. /scheduled_events
        const np: Record<string, string> = {};
        u.searchParams.forEach((v, k) => {
          np[k] = v;
        });
        nextParams = np;
      } catch {
        break;
      }
    }
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
    windowsTotal: 0,
    windowsFailed: 0,
    fetchErrors: [],
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
      } catch (e) {
        // Per-user failures are tolerated, but surface them so the user can
        // see which users hung if it happens (e.g. a Calendly outage on one
        // user's account no longer mysteriously stalls progress at 21/23).
        debug.fetchErrors.push(`event_types ${userUri.slice(-12)}: ${(e as Error).message}`);
      }
    },
    (done, total) => {
      const pct = 8 + Math.round((done / total) * 14);
      tick(`Scanning event types (${done}/${total} users)`, pct);
    },
  );

  // Phase 4 — match event types by internal_note ∈ picked set. When a
  // titlePrefix is supplied (e.g. "Strategy"), event_type.name must also
  // start with that prefix — case-insensitive. This is layered on top so
  // the funnel multi-select still controls funnels; titlePrefix just
  // hides non-Strategy variants like "#1 Game Plan Call".
  const wanted = new Set(opts.notes.map((n) => n.trim().toLowerCase()));
  const prefix = (opts.titlePrefix ?? "").trim().toLowerCase();
  const matchedTypes = allEventTypes.filter((et) => {
    const n = (et.internal_note ?? "").trim().toLowerCase();
    if (n.length === 0 || !wanted.has(n)) return false;
    if (prefix && !(et.name ?? "").trim().toLowerCase().startsWith(prefix)) {
      return false;
    }
    return true;
  });
  debug.eventTypesScanned = allEventTypes.length;
  debug.matchedTypes = matchedTypes.length;

  const matchedTypeByUri = new Map(matchedTypes.map((t) => [t.uri, t]));

  if (matchedTypes.length === 0) {
    const earlyRange = getUserDateRange(opts);
    return {
      rows: [],
      matchedEventTypes: [],
      debug,
      window: { start: earlyRange.start.toISOString(), end: earlyRange.end.toISOString() },
      rawById,
    };
  }

  tick(
    `Matched ${matchedTypes.length} event type${matchedTypes.length === 1 ? "" : "s"} of ${allEventTypes.length} total`,
    25,
  );

  // Phase 5 — fetch scheduled events org-wide, filter locally by event_type
  // AND by event.created_at falling inside the user's creation-time window.
  //
  // Calendly's /scheduled_events API only supports filtering on start_time,
  // not created_at. So we fetch with a WIDE start_time window — far enough
  // back to catch back-dated reschedules, far enough forward to catch calls
  // booked recently for many months out — then drop anything whose
  // created_at falls outside the user's chosen window.
  const userRange = getUserDateRange(opts); // creation-time window (user-chosen)
  const fetchRange = expandToFetchWindow(userRange); // wide start_time window
  const windows = chunkWindow(fetchRange.start, fetchRange.end);

  type Candidate = {
    event: CalendlyScheduledEvent;
    eventType: CalendlyEventType;
  };
  const eventMap = new Map<string, Candidate>();

  type Task = {
    status: "active" | "canceled";
    window: { min: Date; max: Date };
  };
  const tasks: Task[] = [];
  for (const status of ["active", "canceled"] as const) {
    for (const window of windows) tasks.push({ status, window });
  }

  debug.windowsTotal = tasks.length;
  await runWithConcurrency(
    tasks,
    async ({ status, window }) => {
      const fetchOnce = () =>
        fetchAllPages<CalendlyScheduledEvent>("/scheduled_events", {
          organization: orgUri,
          // Calendly rejects sub-second precision on these params with
          // "The supplied parameters are invalid". Strip ms.
          min_start_time: toCalendlyIso(window.min),
          max_start_time: toCalendlyIso(window.max),
          status,
          sort: "start_time:desc",
        });
      let events: CalendlyScheduledEvent[];
      try {
        events = await fetchOnce();
      } catch (e1) {
        // One automatic retry — many "invalid parameters" failures on the
        // first chunk are flaky on Calendly's side and pass on retry.
        try {
          await new Promise((r) => setTimeout(r, 500));
          events = await fetchOnce();
        } catch (e2) {
          debug.windowsFailed++;
          const label = `${status} ${window.min.toISOString().slice(0, 10)}→${window.max.toISOString().slice(0, 10)}`;
          debug.fetchErrors.push(`${label}: ${(e2 as Error).message}`);
          void e1;
          return;
        }
      }
      for (const ev of events) {
        if (eventMap.has(ev.uri)) continue;
        const et = matchedTypeByUri.get(ev.event_type);
        if (!et) continue;

        if (ev.status === "canceled") debug.canceledFetched++;
        else debug.activeFetched++;

        eventMap.set(ev.uri, { event: ev, eventType: et });
      }
    },
    (done, total) => {
      const pct = 25 + Math.round((done / total) * 30);
      tick(`Fetching events (${done}/${total} windows)`, pct);
    },
  );

  // Now narrow by creation time — this is the actual user-visible filter
  // dimension for this app. Anything outside the user's creation window
  // gets dropped here (it was fetched only because Calendly forces us to
  // page by start_time).
  const userMin = userRange.start.getTime();
  const userMax = userRange.end.getTime();
  const allCandidates = Array.from(eventMap.values());
  const candidates = allCandidates.filter(({ event }) => {
    const created = Date.parse(event.created_at);
    return Number.isFinite(created) && created >= userMin && created <= userMax;
  });
  debug.eventsFetched = candidates.length;
  const windowOut = {
    start: userRange.start.toISOString(),
    end: userRange.end.toISOString(),
  };
  if (candidates.length === 0) {
    return { rows: [], matchedEventTypes: matchedTypes, debug, window: windowOut, rawById };
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
          // BQ-enrichment defaults — filled in by the SearchClient after the
          // Calendly fetch completes. Status defaults to a calendar-derived
          // value so the UI works even without enrichment.
          callStatus: deriveStatusFromCalendar(event.start_time, event.status, inv.status),
          wasHeld: null,
          wasNoShow: null,
          isDeal: null,
          cashCollected: null,
          revenueGenerated: null,
          closerOwner: null,
          setterOwner: null,
          callOutcome: null,
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
  return { rows, matchedEventTypes: matchedTypes, debug, window: windowOut, rawById };
}

// Calendly's /scheduled_events docs say up to 1 year per request, but 90-day
// windows have been seen rejected with "supplied parameters are invalid" on
// the first chunk. 60d is conservative; the extra fan-out is cheap compared
// to silently losing months of data.
const MAX_WINDOW_DAYS = 60;

// Calendly's /scheduled_events rejects ISO timestamps with millisecond
// precision ("The supplied parameters are invalid"). Drop ms.
function toCalendlyIso(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function chunkWindow(start: Date, end: Date): { min: Date; max: Date }[] {
  const out: { min: Date; max: Date }[] = [];
  const chunkMs = MAX_WINDOW_DAYS * 86400000;
  let cur = start.getTime();
  const stop = end.getTime();
  while (cur < stop) {
    const next = Math.min(cur + chunkMs, stop);
    out.push({ min: new Date(cur), max: new Date(next) });
    cur = next;
  }
  if (out.length === 0) out.push({ min: start, max: end });
  return out;
}

function getActivePreset(presetKey: PresetKey): Preset {
  return PRESETS.find((p) => p.key === presetKey) || PRESETS.find((p) => p.key === "last7d")!;
}

function getUserDateRange(opts: SearchOptions): { start: Date; end: Date } {
  // In the creation-stats app, this is the user's creation-time window.
  // All presets are past-only (booking-created can't be in the future).
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

// Given the user's creation-time window, return the start_time fetch window
// to send to Calendly. We pad backwards 60 days (catches rescheduled-to-past
// bookings) and forwards 2 years (catches recently-booked future calls).
const FETCH_BACK_PAD_MS = 60 * 86400000;
const FETCH_FORWARD_HORIZON_MS = 2 * 365 * 86400000;
function expandToFetchWindow(userRange: { start: Date; end: Date }): { start: Date; end: Date } {
  return {
    start: new Date(userRange.start.getTime() - FETCH_BACK_PAD_MS),
    end: new Date(userRange.end.getTime() + FETCH_FORWARD_HORIZON_MS),
  };
}

// Derive a baseline call status from calendar-only data — used as a fallback
// before the BQ enrichment lands. After enrichment we promote unknown→held
// or unknown→no_show based on the int_calls_enriched flags.
function deriveStatusFromCalendar(
  startTime: string,
  eventStatus: string,
  inviteeStatus: string,
): "future" | "held" | "no_show" | "canceled" | "unknown" {
  if (inviteeStatus === "canceled" || eventStatus === "canceled") return "canceled";
  const start = Date.parse(startTime);
  if (Number.isNaN(start)) return "unknown";
  if (start > Date.now()) return "future";
  // Past start_time, not canceled — but we can't tell held vs no-show from
  // Calendly alone. Wait for BQ enrichment to promote this row.
  return "unknown";
}

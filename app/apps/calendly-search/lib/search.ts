// The full search pipeline, ported from calendly_internal_note_search_v5.html.
//
// runSearch() drives 7 phases:
//   1. /users/me                                      → org URI
//   2. /organization_memberships                      → all user URIs
//   3. /event_types?user=<each> (parallel)            → all event types
//   4. local filter by internal_note substring        → matched types
//   5. /scheduled_events?status=active,canceled       → events (org-wide)
//   6. /scheduled_events/<uuid>/invitees (parallel)   → invitees
//   7. local date + rescheduled-link reconciliation   → final rows
//
// The pipeline is identical to the original; only the language and the API base
// changed. We use /api/calendly as the proxy instead of a Cloudflare Worker.

import {
  CalendlyEventType,
  CalendlyInvitee,
  CalendlyScheduledEvent,
  DateFilterMode,
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
  note: string;
  dateFilterMode: DateFilterMode;
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
    offFunnelCount: 0,
    afterBookedFilter: 0,
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

  // Phase 3 — per-user event types in parallel (shared types fix)
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

  // Phase 4 — match by internal_note
  const query = opts.note.toLowerCase();
  const matchedTypes = allEventTypes.filter((et) =>
    (et.internal_note || "").toLowerCase().includes(query),
  );
  debug.eventTypesScanned = allEventTypes.length;
  debug.matchedTypes = matchedTypes.length;

  const matchedTypeByUri = new Map(matchedTypes.map((t) => [t.uri, t]));
  const allEventTypeByUri = new Map(allEventTypes.map((t) => [t.uri, t]));

  if (matchedTypes.length === 0) {
    return { rows: [], matchedEventTypes: [], debug, rawById };
  }

  tick(
    `Matched ${matchedTypes.length} event type${matchedTypes.length === 1 ? "" : "s"} of ${allEventTypes.length} total`,
    25,
  );

  // Phase 5 — fetch scheduled events org-wide, filter locally by event_type
  const userRange = getUserDateRange(opts);
  const stWindow = getStartTimeWindow(opts, userRange);

  type Candidate = {
    event: CalendlyScheduledEvent;
    matchedEventType: CalendlyEventType | null;
    actualEventType: CalendlyEventType | null;
    isOffFunnel: boolean;
    possibleOffFunnel: boolean;
  };
  const eventMap = new Map<string, Candidate>();

  const statuses: ("active" | "canceled")[] = ["active", "canceled"];

  await runWithConcurrency(
    statuses,
    async (status) => {
      const events = await fetchAllPages<CalendlyScheduledEvent>("/scheduled_events", {
        organization: orgUri,
        min_start_time: stWindow.min,
        max_start_time: stWindow.max,
        status,
        sort: "start_time:desc",
      });
      for (const ev of events) {
        if (eventMap.has(ev.uri)) continue;
        const directMatch = matchedTypeByUri.get(ev.event_type) || null;
        const actualEt = allEventTypeByUri.get(ev.event_type) || directMatch || null;
        const possibleOffFunnel =
          opts.dateFilterMode === "booked" && !directMatch && ev.status === "active";
        if (!directMatch && !possibleOffFunnel) continue;

        if (ev.status === "canceled") debug.canceledFetched++;
        else debug.activeFetched++;

        eventMap.set(ev.uri, {
          event: ev,
          matchedEventType: directMatch,
          actualEventType: actualEt,
          isOffFunnel: !directMatch,
          possibleOffFunnel,
        });
      }
    },
    (done, total, status) => {
      const pct = 25 + Math.round((done / total) * 30);
      tick(`Fetching ${status} events (${done}/${total})`, pct);
    },
  );

  let candidates = Array.from(eventMap.values());
  debug.eventsFetched = candidates.length;
  if (candidates.length === 0) {
    return { rows: [], matchedEventTypes: matchedTypes, debug, rawById };
  }

  // Phase 6 — invitees per event in parallel
  tick(`Resolving ${candidates.length} bookings...`, 56);
  const tempRows: Row[] = [];

  await runWithConcurrency(
    candidates,
    async ({ event, matchedEventType, actualEventType, isOffFunnel, possibleOffFunnel }) => {
      const path = event.uri.replace("https://api.calendly.com", "");
      const invitees = await fetchAllPages<CalendlyInvitee>(path + "/invitees");

      const memberships = event.event_memberships || [];
      const primary = memberships[0] || {};
      const hostNames = memberships.map((m) => m.user_name).filter((x): x is string => Boolean(x));
      const hostEmails = memberships.map((m) => m.user_email).filter((x): x is string => Boolean(x));
      const allHostNames = hostNames.join(", ");
      const allHostEmails = hostEmails.join(", ");
      const displayEt = actualEventType || matchedEventType || ({} as CalendlyEventType);

      for (const inv of invitees) {
        tempRows.push({
          id: inv.uri,
          eventUri: event.uri,
          inviteeName: inv.name || "—",
          inviteeEmail: (inv.email || "").toLowerCase(),
          inviteeEmailDisplay: inv.email || "—",
          status:
            inv.status === "canceled" || event.status === "canceled" ? "canceled" : "active",
          eventName: event.name || "—",
          eventTypeName: displayEt.name || "—",
          eventTypeKind: displayEt.kind || "—",
          eventTypePooling: displayEt.pooling_type || null,
          internalNote: matchedEventType?.internal_note || "",
          isOffFunnel,
          possibleOffFunnel,
          funnelEventTypeName: matchedEventType?.name || "—",
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
          _eventType: displayEt,
          _matchedEventType: matchedEventType,
          _actualEventType: actualEventType,
        });
      }
    },
    (done, total) => {
      const pct = 56 + Math.round((done / total) * 34);
      tick(`Resolving bookings (${done}/${total})`, pct);
    },
  );

  // Phase 7 — date filter + rescheduled-link reconciliation
  const minMs = userRange.start.getTime();
  const maxMs = userRange.end.getTime();
  const inUserRange = (dt: string | null | undefined) => {
    const t = new Date(dt || "").getTime();
    return Number.isFinite(t) && t >= minMs && t <= maxMs;
  };

  const directRows = tempRows.filter((r) => !r.possibleOffFunnel);
  const directByInviteeUri = new Map(directRows.map((r) => [r.id, r]));
  const directByEmail = new Map<string, Row[]>();
  for (const r of directRows) {
    if (!r.inviteeEmail) continue;
    const arr = directByEmail.get(r.inviteeEmail) ?? [];
    arr.push(r);
    directByEmail.set(r.inviteeEmail, arr);
  }
  const activeUriToFunnelRow = new Map<string, Row>();
  for (const r of directRows) {
    if (r.newInvitee) activeUriToFunnelRow.set(r.newInvitee, r);
  }

  const matched: Row[] = [];
  for (const r of tempRows) {
    let include = false;
    let funnelContext: Row | null = r._matchedEventType ? r : null;

    if (opts.dateFilterMode === "appointment") {
      include = !r.possibleOffFunnel && inUserRange(r.startTime);
    } else if (!r.possibleOffFunnel) {
      include = inUserRange(r.createdAt);
    } else {
      const oldRow = r.oldInvitee ? directByInviteeUri.get(r.oldInvitee) ?? null : null;
      const newLinkedRow = activeUriToFunnelRow.get(r.id) || null;
      const emailLinkedRow =
        (directByEmail.get(r.inviteeEmail) || []).find(
          (x) =>
            x._matchedEventType &&
            (inUserRange(x.createdAt) || x.newInvitee || x.rescheduled || x.status === "canceled"),
        ) || null;
      funnelContext = oldRow || newLinkedRow || emailLinkedRow;
      include = Boolean(funnelContext) && (inUserRange(r.createdAt) || inUserRange(funnelContext!.createdAt));

      if (include && funnelContext?._matchedEventType) {
        r.internalNote = funnelContext._matchedEventType.internal_note || "";
        r.funnelEventTypeName = funnelContext._matchedEventType.name || "—";
        r.isOffFunnel = true;
        debug.offFunnelCount++;
      }
    }

    if (!include) continue;
    matched.push(r);
    rawById.set(r.id, {
      event: r._event,
      invitee: r._invitee,
      eventType: r._eventType,
      matchedEventType: r._matchedEventType || funnelContext?._matchedEventType || null,
      actualEventType: r._actualEventType || r._eventType,
    });
  }

  debug.afterBookedFilter = matched.length;
  debug.finalRows = matched.length;

  tick("Done", 100);
  return { rows: matched, matchedEventTypes: matchedTypes, debug, rawById };
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
  if (preset.direction === "future") {
    return { start: now, end: new Date(now.getTime() + ms) };
  }
  return { start: new Date(now.getTime() - ms), end: now };
}

function getStartTimeWindow(
  opts: SearchOptions,
  userRange: { start: Date; end: Date },
): { min: string; max: string } {
  if (opts.dateFilterMode === "appointment") {
    return { min: userRange.start.toISOString(), max: userRange.end.toISOString() };
  }
  // booked-at mode: bookings made in user's range may have start times far in
  // the future. Use ±365d to catch long-lead bookings.
  const past = new Date(userRange.start.getTime() - 1 * 86400000);
  const future = new Date(Date.now() + 365 * 86400000);
  return { min: past.toISOString(), max: future.toISOString() };
}

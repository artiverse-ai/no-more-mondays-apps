// Admin-only Calendly backfill — runs on Vercel so it uses the BQ service
// account credentials in the env (GOOGLE_APPLICATION_CREDENTIALS_JSON).
//
// POST with { calendlyPat, daysBack, daysForward } and an admin Clerk
// session. The route fetches scheduled_events + invitees from Calendly,
// transforms to our row shape, and bulk-inserts into nmm_calendar.calendly_events.
//
// Returns a JSON summary: { eventsFetched, rowsInserted, durationMs }.

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  ensureCalendlyEventsTable,
  type CalendlyEventRow,
  upsertCalendlyEvents,
} from "@/lib/calendly-events-table";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // seconds — give the route the full Fluid Compute budget

const CALENDLY_BASE = "https://api.calendly.com";
const CHUNK_DAYS = 60;
const CONCURRENCY = 6;

type CalendlyEvent = {
  uri: string;
  name?: string;
  start_time?: string;
  end_time?: string;
  status?: string;
  event_type?: string;
  created_at?: string;
  event_memberships?: Array<{ user_name?: string; user_email?: string }>;
  cancellation?: { reason?: string; canceled_by?: string };
};
type CalendlyInvitee = {
  uri: string;
  name?: string;
  email?: string;
  status?: string;
  timezone?: string;
  created_at?: string;
  rescheduled?: boolean;
  old_invitee?: string | null;
  new_invitee?: string | null;
  questions_and_answers?: unknown;
  cancellation?: { reason?: string; canceled_by?: string; canceler_type?: string };
};
type CalendlyEventType = {
  uri: string;
  name?: string;
  kind?: string;
  internal_note?: string | null;
  pooling_type?: string;
};

function buildRow(event: CalendlyEvent, invitee: CalendlyInvitee, eventType: CalendlyEventType | undefined): CalendlyEventRow {
  const hosts = (event.event_memberships ?? [])
    .map((m) => ({ name: m.user_name ?? "", email: m.user_email ?? "" }))
    .filter((h) => h.name || h.email);
  const isCanceled = invitee.status === "canceled" || event.status === "canceled";
  return {
    event_uri: event.uri,
    invitee_uri: invitee.uri,
    webhook_event_type: invitee.status === "canceled" ? "invitee.canceled" : "invitee.created",
    webhook_received_at: new Date().toISOString(),
    source: "backfill",
    event_type_uri: eventType?.uri ?? event.event_type ?? null,
    event_type_name: eventType?.name ?? null,
    event_type_kind: eventType?.kind ?? null,
    event_type_internal_note: eventType?.internal_note ?? null,
    event_type_pooling: eventType?.pooling_type ?? null,
    event_status: event.status ?? null,
    start_time: event.start_time ?? null,
    end_time: event.end_time ?? null,
    event_created_at: event.created_at ?? null,
    invitee_name: invitee.name ?? null,
    invitee_email: invitee.email ?? null,
    invitee_email_lc: (invitee.email ?? "").toLowerCase() || null,
    invitee_status: invitee.status ?? null,
    invitee_timezone: invitee.timezone ?? null,
    invitee_created_at: invitee.created_at ?? null,
    invitee_canceled: isCanceled,
    invitee_rescheduled: Boolean(invitee.rescheduled),
    invitee_old_invitee: invitee.old_invitee ?? null,
    invitee_new_invitee: invitee.new_invitee ?? null,
    invitee_questions_and_answers: invitee.questions_and_answers ?? null,
    hosts,
    primary_host_name: hosts[0]?.name ?? null,
    primary_host_email: hosts[0]?.email ?? null,
    cancel_reason: invitee.cancellation?.reason ?? event.cancellation?.reason ?? null,
    canceled_by: invitee.cancellation?.canceled_by ?? event.cancellation?.canceled_by ?? null,
    canceler_type: invitee.cancellation?.canceler_type ?? null,
    is_no_show: false,
    no_show_at: null,
    raw_payload: { event, invitee, event_type: eventType ?? null },
    updated_at: new Date().toISOString(),
  };
}

async function calendlyGet(pat: string, path: string, params?: Record<string, string | number>): Promise<{ collection?: unknown[]; resource?: unknown; pagination?: { next_page?: string } }> {
  const url = new URL(path.startsWith("http") ? path : `${CALENDLY_BASE}${path}`);
  if (params) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${pat}`, "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Calendly ${res.status} ${url.pathname}: ${body.slice(0, 300)}`);
  }
  return res.json() as Promise<{ collection?: unknown[]; resource?: unknown; pagination?: { next_page?: string } }>;
}

async function fetchAllPages<T>(pat: string, path: string, params: Record<string, string | number>): Promise<T[]> {
  const out: T[] = [];
  let next: string | null = null;
  let first = true;
  while (first || next) {
    first = false;
    const data: { collection?: T[]; pagination?: { next_page?: string | null } } = next
      ? (await calendlyGet(pat, next)) as { collection?: T[]; pagination?: { next_page?: string | null } }
      : (await calendlyGet(pat, path, params)) as { collection?: T[]; pagination?: { next_page?: string | null } };
    if (Array.isArray(data.collection)) out.push(...data.collection);
    next = data.pagination?.next_page ?? null;
  }
  return out;
}

async function runWithConcurrency<T>(items: T[], fn: (item: T, idx: number) => Promise<void>, limit: number): Promise<void> {
  let i = 0;
  async function worker() {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!me.isAdmin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  let body: { calendlyPat?: string; daysBack?: number; daysForward?: number };
  try { body = await req.json() as typeof body; } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const pat = body.calendlyPat;
  if (!pat) return NextResponse.json({ error: "calendlyPat required in body" }, { status: 400 });
  const daysBack = body.daysBack ?? 30;
  const daysForward = body.daysForward ?? 730;

  const t0 = Date.now();
  const log: string[] = [];
  try {
    await ensureCalendlyEventsTable();
    log.push("table ready");

    const me2 = await calendlyGet(pat, "/users/me");
    const orgUri = (me2.resource as { current_organization: string }).current_organization;
    log.push(`org=${orgUri}`);

    // Pull every event_type via memberships (gives us internal_note).
    const memberships = await fetchAllPages<{ user: { uri: string } }>(pat, "/organization_memberships", { organization: orgUri, count: 100 });
    log.push(`memberships=${memberships.length}`);

    const eventTypesByUri = new Map<string, CalendlyEventType>();
    await runWithConcurrency(memberships, async (m) => {
      const ets = await fetchAllPages<CalendlyEventType>(pat, "/event_types", { user: m.user.uri, count: 100 });
      for (const et of ets) if (!eventTypesByUri.has(et.uri)) eventTypesByUri.set(et.uri, et);
    }, CONCURRENCY);
    log.push(`event_types=${eventTypesByUri.size}`);

    // Chunk start_time window.
    const today = Date.now();
    const winStart = new Date(today - daysBack * 86400000);
    const winEnd = new Date(today + daysForward * 86400000);
    const windows: Array<{ min: Date; max: Date }> = [];
    let cursor = winStart;
    while (cursor < winEnd) {
      const end = new Date(Math.min(cursor.getTime() + CHUNK_DAYS * 86400000, winEnd.getTime()));
      windows.push({ min: cursor, max: end });
      cursor = end;
    }
    const tasks: Array<{ status: "active" | "canceled"; window: { min: Date; max: Date } }> = [];
    for (const status of ["active", "canceled"] as const) {
      for (const w of windows) tasks.push({ status, window: w });
    }
    log.push(`fetch_tasks=${tasks.length}`);

    const allEvents = new Map<string, CalendlyEvent>();
    await runWithConcurrency(tasks, async ({ status, window }) => {
      const events = await fetchAllPages<CalendlyEvent>(pat, "/scheduled_events", {
        organization: orgUri,
        min_start_time: window.min.toISOString().replace(/\.\d{3}Z$/, "Z"),
        max_start_time: window.max.toISOString().replace(/\.\d{3}Z$/, "Z"),
        status,
        count: 100,
      });
      for (const ev of events) if (!allEvents.has(ev.uri)) allEvents.set(ev.uri, ev);
    }, CONCURRENCY);
    log.push(`unique_events=${allEvents.size}`);

    // Invitees per event.
    const rows: CalendlyEventRow[] = [];
    await runWithConcurrency(Array.from(allEvents.values()), async (event) => {
      try {
        const invitees = await fetchAllPages<CalendlyInvitee>(pat, `${event.uri}/invitees`, { count: 100 });
        const et = eventTypesByUri.get(event.event_type ?? "");
        for (const inv of invitees) rows.push(buildRow(event, inv, et));
      } catch {
        // swallow — log only
      }
    }, CONCURRENCY);
    log.push(`rows=${rows.length}`);

    // Insert in batches.
    const BATCH = 200;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
      const slice = rows.slice(i, i + BATCH);
      await upsertCalendlyEvents(slice);
      inserted += slice.length;
    }
    log.push(`inserted=${inserted}`);

    return NextResponse.json({
      ok: true,
      durationMs: Date.now() - t0,
      stats: {
        memberships: memberships.length,
        event_types: eventTypesByUri.size,
        windows: windows.length,
        unique_events: allEvents.size,
        rows_inserted: inserted,
      },
      log,
    });
  } catch (e) {
    return NextResponse.json({
      error: (e as Error).message,
      durationMs: Date.now() - t0,
      log,
    }, { status: 500 });
  }
}

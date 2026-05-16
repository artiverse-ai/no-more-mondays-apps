#!/usr/bin/env node
/**
 * Backfill nmm_calendar.calendly_events from the Calendly API.
 *
 * Usage:
 *   CALENDLY_PAT=<token> \
 *   BQ_PROJECT=no-more-mondays-analytics \
 *   GOOGLE_APPLICATION_CREDENTIALS=<path-to-key.json> \
 *     node scripts/backfill-calendly-events.mjs
 *
 * Options (env vars):
 *   BACKFILL_DAYS_BACK=30        How far back to seed. Default 30.
 *   BACKFILL_DAYS_FORWARD=730    How far forward (future-scheduled calls).
 *   DRY_RUN=1                    Print what would happen, don't write.
 *
 * Strategy:
 *   1. Resolve org via /users/me
 *   2. Fetch every event_type once (one API call, gives us internal_note map)
 *   3. Chunk the (start_time) window into 60-day pieces × 2 statuses
 *   4. Fetch /scheduled_events per chunk (paginated)
 *   5. For each event, fetch /scheduled_events/{uuid}/invitees (paginated)
 *   6. Build rows, INSERT to BQ in batches of 200
 */

import { BigQuery } from "@google-cloud/bigquery";

const PAT = process.env.CALENDLY_PAT;
if (!PAT) {
  console.error("ERROR: set CALENDLY_PAT env var (Calendly personal access token).");
  process.exit(1);
}

const BQ_PROJECT = process.env.BQ_PROJECT ?? "no-more-mondays-analytics";
const BQ_DATASET = process.env.BQ_DATASET ?? "nmm_calendar";
const DAYS_BACK = Number(process.env.BACKFILL_DAYS_BACK ?? 30);
const DAYS_FORWARD = Number(process.env.BACKFILL_DAYS_FORWARD ?? 730);
const DRY_RUN = process.env.DRY_RUN === "1";
const CHUNK_DAYS = 60;
const CONCURRENCY = 4;

const CALENDLY_BASE = "https://api.calendly.com";

const bq = DRY_RUN ? null : new BigQuery({ projectId: BQ_PROJECT });
const tableRef = bq?.dataset(BQ_DATASET).table("calendly_events");

const ROOT_TABLE = `\`${BQ_PROJECT}.${BQ_DATASET}.calendly_events\``;

// ---------------------------------------------------------------------------
// Calendly client (paginated)
// ---------------------------------------------------------------------------
async function calendlyGet(path, params) {
  const url = new URL(path.startsWith("http") ? path : `${CALENDLY_BASE}${path}`);
  if (params) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${PAT}`, "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Calendly ${res.status} ${url.pathname}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function fetchAllPages(path, params) {
  let next = null;
  const all = [];
  let firstCall = true;
  while (firstCall || next) {
    firstCall = false;
    const data = next
      ? await calendlyGet(next, null)
      : await calendlyGet(path, params);
    if (Array.isArray(data.collection)) all.push(...data.collection);
    next = data.pagination?.next_page ?? null;
  }
  return all;
}

// ---------------------------------------------------------------------------
// Concurrency helper
// ---------------------------------------------------------------------------
async function runWithConcurrency(items, fn, limit) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      out[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

// ---------------------------------------------------------------------------
// Transform
// ---------------------------------------------------------------------------
function buildRow(event, invitee, eventType) {
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
    is_no_show: false, // backfill can't reliably reconstruct historical no-shows
    no_show_at: null,
    raw_payload: { event, invitee, event_type: eventType },
    updated_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`[backfill] window: ${DAYS_BACK}d back, ${DAYS_FORWARD}d forward · dry_run=${DRY_RUN}`);

  const me = await calendlyGet("/users/me");
  const orgUri = me.resource.current_organization;
  console.log(`[backfill] org: ${orgUri}`);

  // Pull every event_type in the org (paginated, gives us internal_note).
  const memberships = await fetchAllPages("/organization_memberships", { organization: orgUri, count: 100 });
  console.log(`[backfill] memberships: ${memberships.length}`);
  const eventTypesByUri = new Map();
  await runWithConcurrency(memberships, async (m) => {
    const ets = await fetchAllPages("/event_types", { user: m.user.uri, count: 100 });
    for (const et of ets) if (!eventTypesByUri.has(et.uri)) eventTypesByUri.set(et.uri, et);
  }, CONCURRENCY);
  console.log(`[backfill] event_types: ${eventTypesByUri.size}`);

  // Build start_time windows.
  const today = new Date();
  const windowStart = new Date(today.getTime() - DAYS_BACK * 86400000);
  const windowEnd = new Date(today.getTime() + DAYS_FORWARD * 86400000);
  const windows = [];
  let cursor = windowStart;
  while (cursor < windowEnd) {
    const chunkEnd = new Date(Math.min(cursor.getTime() + CHUNK_DAYS * 86400000, windowEnd.getTime()));
    windows.push({ min: cursor, max: chunkEnd });
    cursor = chunkEnd;
  }
  console.log(`[backfill] chunks: ${windows.length} × 2 statuses = ${windows.length * 2} fetches`);

  const tasks = [];
  for (const status of ["active", "canceled"]) {
    for (const w of windows) tasks.push({ status, window: w });
  }

  // Fetch events.
  const allEvents = new Map();
  let done = 0;
  await runWithConcurrency(tasks, async ({ status, window }) => {
    const events = await fetchAllPages("/scheduled_events", {
      organization: orgUri,
      min_start_time: window.min.toISOString().replace(/\.\d{3}Z$/, "Z"),
      max_start_time: window.max.toISOString().replace(/\.\d{3}Z$/, "Z"),
      status,
      count: 100,
    });
    for (const ev of events) {
      if (!allEvents.has(ev.uri)) allEvents.set(ev.uri, ev);
    }
    done++;
    console.log(`[backfill] chunk ${done}/${tasks.length} · status=${status} · ${window.min.toISOString().slice(0, 10)}→${window.max.toISOString().slice(0, 10)} · ${events.length} events`);
  }, CONCURRENCY);

  console.log(`[backfill] unique events: ${allEvents.size}`);

  // Fetch invitees per event.
  const rows = [];
  const eventList = Array.from(allEvents.values());
  await runWithConcurrency(eventList, async (event) => {
    const eventType = eventTypesByUri.get(event.event_type);
    let invitees = [];
    try {
      invitees = await fetchAllPages(`${event.uri}/invitees`, { count: 100 });
    } catch (e) {
      console.warn(`[backfill] invitees failed for ${event.uri}: ${e.message}`);
      return;
    }
    for (const inv of invitees) rows.push(buildRow(event, inv, eventType));
  }, CONCURRENCY);

  console.log(`[backfill] rows to insert: ${rows.length}`);

  if (DRY_RUN) {
    console.log("[backfill] DRY_RUN — first 3 rows preview:");
    console.log(JSON.stringify(rows.slice(0, 3), null, 2));
    return;
  }

  // Insert in batches of 200.
  const BATCH = 200;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    await tableRef.insert(batch, { ignoreUnknownValues: false, skipInvalidRows: false });
    console.log(`[backfill] inserted ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
  }

  console.log(`[backfill] ✅ done · ${rows.length} rows into ${ROOT_TABLE}`);
}

main().catch((e) => {
  console.error("[backfill] fatal:", e);
  process.exit(1);
});

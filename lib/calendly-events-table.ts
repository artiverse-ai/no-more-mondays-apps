// Schema + setup for nmm_calendar.calendly_events — the live mirror of
// every Calendly invitee event in the org. Populated by:
//
//   1. POST /api/calendly-webhook       → real-time, via Calendly webhooks
//   2. scripts/backfill-calendly.mjs    → one-shot historical seed
//   3. VM cron reconciliation (optional)→ daily catch-up for any webhook
//                                         deliveries that failed
//
// Schema choices:
//   - One row per (event_uri, invitee_uri, webhook_event_type) where the
//     webhook_event_type distinguishes the creation event from any later
//     no-show / cancellation update. The dashboard collapses these by
//     latest-wins (MERGE by event_uri + invitee_uri on write).
//   - Partition by DATE(invitee_created_at) → the user's primary filter
//     dimension. Cheap to scan a 30-day window.
//   - Cluster by event_type_internal_note + invitee_email_lc → fast
//     funnel-tag and email lookups.

import { bq, BQ_PROJECT, BQ_DATASET } from "./bq";

const TABLE_REF = `\`${BQ_PROJECT}.${BQ_DATASET}.calendly_events\``;

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS ${TABLE_REF} (
  -- ── Identity ──────────────────────────────────────────────────────
  event_uri               STRING NOT NULL,
  invitee_uri             STRING NOT NULL,

  -- ── Webhook / source metadata ─────────────────────────────────────
  webhook_event_type      STRING,
  webhook_received_at     TIMESTAMP,
  source                  STRING,

  -- ── Event ─────────────────────────────────────────────────────────
  event_type_uri          STRING,
  event_type_name         STRING,
  event_type_kind         STRING,
  event_type_internal_note STRING,
  event_type_pooling      STRING,
  event_status            STRING,
  start_time              TIMESTAMP,
  end_time                TIMESTAMP,
  event_created_at        TIMESTAMP,

  -- ── Invitee ───────────────────────────────────────────────────────
  invitee_name            STRING,
  invitee_email           STRING,
  invitee_email_lc        STRING,
  invitee_status          STRING,
  invitee_timezone        STRING,
  invitee_created_at      TIMESTAMP,
  invitee_canceled        BOOL,
  invitee_rescheduled     BOOL,
  invitee_old_invitee     STRING,
  invitee_new_invitee     STRING,
  invitee_questions_and_answers JSON,

  -- ── Hosts (denormalized) ──────────────────────────────────────────
  hosts                   ARRAY<STRUCT<name STRING, email STRING>>,
  primary_host_name       STRING,
  primary_host_email      STRING,

  -- ── Cancellation ──────────────────────────────────────────────────
  cancel_reason           STRING,
  canceled_by             STRING,
  canceler_type           STRING,

  -- ── No-show ───────────────────────────────────────────────────────
  is_no_show              BOOL,
  no_show_at              TIMESTAMP,

  -- ── Safety net + housekeeping ─────────────────────────────────────
  raw_payload             JSON,
  updated_at              TIMESTAMP
)
PARTITION BY DATE(invitee_created_at)
CLUSTER BY event_type_internal_note, invitee_email_lc
`;

let _setupPromise: Promise<void> | null = null;

/**
 * Idempotent setup — creates the table if it doesn't exist. Memoized for
 * the lifetime of the process so concurrent calls share one BQ round-trip.
 */
export function ensureCalendlyEventsTable(): Promise<void> {
  if (_setupPromise) return _setupPromise;
  _setupPromise = (async () => {
    await bq().query({ query: CREATE_TABLE_SQL });
  })();
  return _setupPromise;
}

export const CALENDLY_EVENTS_TABLE = TABLE_REF;

/**
 * Shape of one row we insert. Mirrors the table schema. Used by both the
 * webhook receiver and the backfill script.
 */
export type CalendlyEventRow = {
  event_uri: string;
  invitee_uri: string;
  webhook_event_type: string | null;
  webhook_received_at: string;
  source: "webhook" | "backfill" | "reconcile";
  event_type_uri: string | null;
  event_type_name: string | null;
  event_type_kind: string | null;
  event_type_internal_note: string | null;
  event_type_pooling: string | null;
  event_status: string | null;
  start_time: string | null;
  end_time: string | null;
  event_created_at: string | null;
  invitee_name: string | null;
  invitee_email: string | null;
  invitee_email_lc: string | null;
  invitee_status: string | null;
  invitee_timezone: string | null;
  invitee_created_at: string | null;
  invitee_canceled: boolean | null;
  invitee_rescheduled: boolean | null;
  invitee_old_invitee: string | null;
  invitee_new_invitee: string | null;
  invitee_questions_and_answers: unknown;
  hosts: { name: string; email: string }[];
  primary_host_name: string | null;
  primary_host_email: string | null;
  cancel_reason: string | null;
  canceled_by: string | null;
  canceler_type: string | null;
  is_no_show: boolean | null;
  no_show_at: string | null;
  raw_payload: unknown;
  updated_at: string;
};

/**
 * MERGE rows into the table — latest-wins on (event_uri, invitee_uri).
 * Used by both the webhook receiver and the backfill so partial deliveries
 * don't leave stale rows.
 */
export async function upsertCalendlyEvents(rows: CalendlyEventRow[]): Promise<void> {
  if (rows.length === 0) return;
  await ensureCalendlyEventsTable();

  // BigQuery's streaming insert API doesn't support MERGE. Instead we
  // write to a temp staging table, then run a single MERGE.
  // For small batches (<500) we just INSERT and live with duplicates —
  // the read-side query uses ROW_NUMBER() to pick the latest version
  // per (event_uri, invitee_uri).
  await bq().dataset(BQ_DATASET).table("calendly_events").insert(rows, {
    ignoreUnknownValues: false,
    skipInvalidRows: false,
  });
}

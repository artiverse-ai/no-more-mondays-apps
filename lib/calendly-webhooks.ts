// Append-only ledger of every Calendly webhook delivery. Lives in
// nmm_calendar.calendly_webhook_events — same dataset as the rest of the
// calendar-domain tables.
//
// The receiver (app/api/webhooks/calendly/route.ts) inserts here; the
// listRecentEvents helper is what dashboards will eventually read.
// Built but NOT subscribed — to start receiving events, run the curl in
// docs/CALENDLY_WEBHOOKS.md.

import crypto from "node:crypto";
import { bq, table } from "./bq";

export type CalendlyWebhookEventType =
  | "invitee.created"
  | "invitee.canceled"
  | "invitee_no_show.created"
  | "invitee_no_show.deleted"
  | "routing_form_submission.created";

export type CalendlyWebhookRecord = {
  id: string;
  eventType: CalendlyWebhookEventType | string;
  calendlyEventUri: string | null;
  inviteeUri: string | null;
  occurredAt: string; // ISO — Calendly's `created_at` on the envelope
  receivedAt: string; // ISO — when our endpoint accepted it
  payload: string; // raw JSON string of `payload` field
  signatureValid: boolean;
};

const TABLE = table("calendly_webhook_events");

let _tableReady = false;
async function ensureTable(): Promise<void> {
  if (_tableReady) return;
  await bq().query({
    query: `CREATE TABLE IF NOT EXISTS ${TABLE} (
      id STRING NOT NULL,
      event_type STRING NOT NULL,
      calendly_event_uri STRING,
      invitee_uri STRING,
      occurred_at TIMESTAMP NOT NULL,
      received_at TIMESTAMP NOT NULL,
      payload STRING NOT NULL,
      signature_valid BOOL NOT NULL
    )
    PARTITION BY DATE(received_at)
    CLUSTER BY event_type, calendly_event_uri`,
  });
  _tableReady = true;
}

/**
 * Verify the `Calendly-Webhook-Signature` header. The header format is
 *   t=<unix-ts>,v1=<hex>
 * v1 = HMAC-SHA256(signing_key, `${t}.${rawBody}`).
 *
 * Returns true if the signature is valid and the timestamp is within the
 * allowed skew (default 5 min — protects against replay).
 */
export function verifyCalendlySignature({
  header,
  rawBody,
  signingKey,
  maxAgeSeconds = 300,
}: {
  header: string | null;
  rawBody: string;
  signingKey: string;
  maxAgeSeconds?: number;
}): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const i = p.indexOf("=");
      return i === -1 ? [p.trim(), ""] : [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    }),
  );
  const t = parts["t"];
  const v1 = parts["v1"];
  if (!t || !v1) return false;

  const tNum = Number(t);
  if (!Number.isFinite(tNum)) return false;
  const ageSec = Math.abs(Date.now() / 1000 - tNum);
  if (ageSec > maxAgeSeconds) return false;

  const expected = crypto
    .createHmac("sha256", signingKey)
    .update(`${t}.${rawBody}`)
    .digest("hex");

  const a = Buffer.from(v1, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Append one webhook delivery to the ledger. Idempotent on Calendly's
 * delivery `id` — if we get a retry, we skip the second insert.
 */
export async function insertWebhookEvent(record: CalendlyWebhookRecord): Promise<void> {
  await ensureTable();
  await bq().query({
    query: `MERGE ${TABLE} t
            USING (SELECT @id AS id) s
            ON t.id = s.id
            WHEN NOT MATCHED THEN
              INSERT (id, event_type, calendly_event_uri, invitee_uri,
                      occurred_at, received_at, payload, signature_valid)
              VALUES (@id, @event_type, @calendly_event_uri, @invitee_uri,
                      TIMESTAMP(@occurred_at), TIMESTAMP(@received_at),
                      @payload, @signature_valid)`,
    params: {
      id: record.id,
      event_type: record.eventType,
      calendly_event_uri: record.calendlyEventUri,
      invitee_uri: record.inviteeUri,
      occurred_at: record.occurredAt,
      received_at: record.receivedAt,
      payload: record.payload,
      signature_valid: record.signatureValid,
    },
    types: {
      id: "STRING",
      event_type: "STRING",
      calendly_event_uri: "STRING",
      invitee_uri: "STRING",
      occurred_at: "STRING",
      received_at: "STRING",
      payload: "STRING",
      signature_valid: "BOOL",
    },
  });
}

/** Most recent N events, newest first. Used by the dashboard later. */
export async function listRecentEvents(limit = 50): Promise<CalendlyWebhookRecord[]> {
  await ensureTable();
  const [rows] = await bq().query({
    query: `SELECT id, event_type, calendly_event_uri, invitee_uri,
                   FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', occurred_at, 'UTC') AS occurred_at,
                   FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', received_at, 'UTC') AS received_at,
                   payload, signature_valid
            FROM ${TABLE}
            ORDER BY received_at DESC
            LIMIT @limit`,
    params: { limit },
    types: { limit: "INT64" },
  });
  return (rows as Array<{
    id: string;
    event_type: string;
    calendly_event_uri: string | null;
    invitee_uri: string | null;
    occurred_at: string;
    received_at: string;
    payload: string;
    signature_valid: boolean;
  }>).map((r) => ({
    id: r.id,
    eventType: r.event_type as CalendlyWebhookEventType,
    calendlyEventUri: r.calendly_event_uri,
    inviteeUri: r.invitee_uri,
    occurredAt: r.occurred_at,
    receivedAt: r.received_at,
    payload: r.payload,
    signatureValid: r.signature_valid,
  }));
}

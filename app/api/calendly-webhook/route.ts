// Calendly webhook receiver. Validates HMAC signature, transforms the
// payload into our table shape, INSERTs into nmm_calendar.calendly_events.
//
// Subscribed event types:
//   - invitee.created            → new booking (active)
//   - invitee.canceled           → existing booking canceled
//   - invitee_no_show.created    → host marked invitee as no-show
//   - invitee_no_show.deleted    → host un-marked the no-show
//
// Calendly will retry failed deliveries (non-2xx) for 24h with backoff.
// We return 200 quickly even if BQ insertion fails async — we log the
// error and let the daily reconciliation cron catch the miss.
//
// Setup steps (one-time):
//   1. Set CALENDLY_WEBHOOK_SIGNING_KEY env var (generated when you call
//      Calendly's webhook_subscriptions API).
//   2. POST a subscription to Calendly pointing at this URL — see
//      scripts/register-calendly-webhook.mjs.

import { NextResponse } from "next/server";
import crypto from "node:crypto";
import {
  type CalendlyEventRow,
  upsertCalendlyEvents,
} from "@/lib/calendly-events-table";

export const dynamic = "force-dynamic";

const SIGNING_KEY = process.env.CALENDLY_WEBHOOK_SIGNING_KEY ?? "";

// ---------------------------------------------------------------------------
// HMAC signature verification
// ---------------------------------------------------------------------------
// Calendly's webhook signature header looks like:
//   Calendly-Webhook-Signature: t=1234567890,v1=<hex>
// We compute HMAC-SHA256 over `${t}.${rawBody}` with the signing key and
// compare to v1 in constant time.
function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!SIGNING_KEY) return false;
  if (!signatureHeader) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => p.split("=").map((s) => s.trim())) as [string, string][],
  );
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;

  // 5-minute tolerance to defend against replay attacks.
  const ts = Number(t);
  if (!Number.isFinite(ts)) return false;
  const skew = Math.abs(Date.now() / 1000 - ts);
  if (skew > 300) return false;

  const computed = crypto
    .createHmac("sha256", SIGNING_KEY)
    .update(`${t}.${rawBody}`)
    .digest("hex");
  // Constant-time comparison.
  try {
    return crypto.timingSafeEqual(Buffer.from(v1, "hex"), Buffer.from(computed, "hex"));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Payload → table row
// ---------------------------------------------------------------------------
type CalendlyWebhookPayload = {
  event: string;
  payload: {
    event?: { uri?: string; name?: string; start_time?: string; end_time?: string; status?: string; event_type?: string; created_at?: string; event_memberships?: Array<{ user_name?: string; user_email?: string }>; cancellation?: { reason?: string; canceled_by?: string; created_by?: string } };
    invitee?: { uri?: string; name?: string; email?: string; status?: string; timezone?: string; created_at?: string; rescheduled?: boolean; old_invitee?: string | null; new_invitee?: string | null; questions_and_answers?: unknown; cancellation?: { reason?: string; canceled_by?: string; canceler_type?: string } };
    no_show?: { invitee?: string; created_at?: string };
    event_type?: { uri?: string; name?: string; kind?: string; internal_note?: string | null; pooling_type?: string };
  };
};

function payloadToRow(
  webhookEventType: string,
  payload: CalendlyWebhookPayload["payload"],
  rawPayload: unknown,
): CalendlyEventRow | null {
  const event = payload.event ?? {};
  const invitee = payload.invitee ?? {};
  const eventType = payload.event_type ?? {};
  const noShow = payload.no_show ?? {};

  const event_uri = event.uri ?? "";
  const invitee_uri = invitee.uri ?? noShow.invitee ?? "";
  if (!event_uri || !invitee_uri) return null;

  const hosts = (event.event_memberships ?? [])
    .map((m) => ({ name: m.user_name ?? "", email: m.user_email ?? "" }))
    .filter((h) => h.name || h.email);
  const isCanceled = invitee.status === "canceled" || event.status === "canceled";
  const isNoShow = webhookEventType === "invitee_no_show.created";

  return {
    event_uri,
    invitee_uri,
    webhook_event_type: webhookEventType,
    webhook_received_at: new Date().toISOString(),
    source: "webhook",
    event_type_uri: eventType.uri ?? event.event_type ?? null,
    event_type_name: eventType.name ?? null,
    event_type_kind: eventType.kind ?? null,
    event_type_internal_note: eventType.internal_note ?? null,
    event_type_pooling: eventType.pooling_type ?? null,
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
    cancel_reason:
      invitee.cancellation?.reason ?? event.cancellation?.reason ?? null,
    canceled_by:
      invitee.cancellation?.canceled_by ?? event.cancellation?.canceled_by ?? null,
    canceler_type: invitee.cancellation?.canceler_type ?? null,
    is_no_show: isNoShow,
    no_show_at: isNoShow ? noShow.created_at ?? new Date().toISOString() : null,
    raw_payload: rawPayload,
    updated_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("calendly-webhook-signature");

  // Signature check is required when CALENDLY_WEBHOOK_SIGNING_KEY is set.
  // In dev (no key set) we accept anything so local curl tests work.
  if (SIGNING_KEY && !verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: CalendlyWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as CalendlyWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = payload.event ?? "";
  const allowedEvents = new Set([
    "invitee.created",
    "invitee.canceled",
    "invitee_no_show.created",
    "invitee_no_show.deleted",
  ]);
  if (!allowedEvents.has(eventType)) {
    // Acknowledge but ignore unrelated event types so Calendly stops retrying.
    return NextResponse.json({ ignored: eventType });
  }

  const row = payloadToRow(eventType, payload.payload, payload);
  if (!row) {
    return NextResponse.json({ ignored: "missing event_uri or invitee_uri" });
  }

  try {
    await upsertCalendlyEvents([row]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    // Log the failure but return 200 so Calendly doesn't hammer retries —
    // the daily reconciliation cron will pick this up.
    console.error("[calendly-webhook] insert failed:", (e as Error).message, {
      event_uri: row.event_uri,
      invitee_uri: row.invitee_uri,
    });
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 200 });
  }
}

// Quick health-check / debug endpoint (no signature needed).
export async function GET() {
  return NextResponse.json({
    ok: true,
    signing_key_configured: Boolean(SIGNING_KEY),
    table: "nmm_calendar.calendly_events",
  });
}

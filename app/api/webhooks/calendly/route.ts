// Calendly webhook receiver.
//
// Flow:
//   1. Calendly POSTs the delivery JSON, signs it with our shared secret
//      (CALENDLY_WEBHOOK_SIGNING_KEY) and includes the signature in the
//      `Calendly-Webhook-Signature` header.
//   2. We verify the HMAC, parse the envelope, and append to BQ.
//   3. Respond 2xx within 10s or Calendly will retry.
//
// Subscription is NOT created yet — see docs/CALENDLY_WEBHOOKS.md for the
// one-time curl. This endpoint just sits ready.

import { NextResponse } from "next/server";
import {
  CalendlyWebhookEventType,
  insertWebhookEvent,
  verifyCalendlySignature,
} from "@/lib/calendly-webhooks";
import crypto from "node:crypto";

export const dynamic = "force-dynamic";
export const revalidate = 0;
// Webhook deliveries can technically exceed the default Vercel timeout if
// BQ is slow; give the function some headroom but keep it under Calendly's
// 10s ceiling so it doesn't think we failed.
export const maxDuration = 9;

type CalendlyEnvelope = {
  event: CalendlyWebhookEventType | string;
  created_at: string;
  payload?: {
    event?: string; // event URI
    invitee?: string; // invitee URI
    uri?: string; // some payloads use uri instead
    [k: string]: unknown;
  };
};

export async function POST(req: Request) {
  const signingKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY;
  if (!signingKey) {
    // Don't 200 — we want this misconfiguration to surface, not silently
    // drop events. Calendly will retry; we'll see the failure in logs.
    return NextResponse.json(
      { error: "CALENDLY_WEBHOOK_SIGNING_KEY not configured" },
      { status: 503 },
    );
  }

  const rawBody = await req.text();
  const header = req.headers.get("calendly-webhook-signature");
  const signatureValid = verifyCalendlySignature({
    header,
    rawBody,
    signingKey,
  });

  if (!signatureValid) {
    console.warn("[calendly-webhook] invalid signature", {
      header: header?.slice(0, 64) ?? null,
    });
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let envelope: CalendlyEnvelope;
  try {
    envelope = JSON.parse(rawBody) as CalendlyEnvelope;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const calendlyEventUri =
    typeof envelope.payload?.event === "string" ? envelope.payload.event : null;
  const inviteeUri =
    typeof envelope.payload?.invitee === "string" ? envelope.payload.invitee : null;

  try {
    await insertWebhookEvent({
      id,
      eventType: envelope.event,
      calendlyEventUri,
      inviteeUri,
      occurredAt: envelope.created_at || now,
      receivedAt: now,
      payload: JSON.stringify(envelope.payload ?? {}),
      signatureValid: true,
    });
  } catch (e) {
    // Return 500 so Calendly retries — better than silently losing the
    // event because BQ had a hiccup.
    console.error("[calendly-webhook] BQ insert failed", e);
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}

// Some platforms ping GET to verify the endpoint exists. Cheap response so
// nobody mistakes us for a dead route.
export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "calendly-webhook-receiver",
    note: "Use POST with a Calendly-Webhook-Signature header.",
  });
}

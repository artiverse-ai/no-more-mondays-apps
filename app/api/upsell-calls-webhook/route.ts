// Calendly webhook → Airtable "Upsell Calls" intake.
//
// Receives invitee.created / invitee.canceled events for the org. For
// "Scaling Call | Coach X" bookings it creates / updates the matching
// Upsell Calls row in the Coaching CRM (see lib/upsell-calls.ts).
// Every other Calendly event is acknowledged and ignored.
//
// Setup:
//   1. Env vars: CALENDLY_UPSELL_SIGNING_KEY, AIRTABLE_TOKEN.
//   2. Register an org-scoped Calendly webhook subscription pointing at
//      this route, passing the same signing key.
//
// Always returns 200 (even on a downstream error) so Calendly doesn't
// disable the subscription after repeated non-2xx responses — failures
// are logged instead.

import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { handleCalendlyEvent } from "@/lib/upsell-calls";

export const dynamic = "force-dynamic";

const SIGNING_KEY = process.env.CALENDLY_UPSELL_SIGNING_KEY ?? "";

// Calendly signs each delivery: header `Calendly-Webhook-Signature:
// t=<unix>,v1=<hex>`, where v1 = HMAC-SHA256 of `${t}.${rawBody}`.
function verifySignature(rawBody: string, header: string | null): boolean {
  if (!SIGNING_KEY || !header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => p.split("=").map((s) => s.trim())),
  ) as Record<string, string>;
  const { t, v1 } = parts;
  if (!t || !v1) return false;
  const ts = Number(t);
  // 5-minute tolerance to blunt replay attacks.
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;
  const computed = crypto
    .createHmac("sha256", SIGNING_KEY)
    .update(`${t}.${rawBody}`)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(v1, "hex"), Buffer.from(computed, "hex"));
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const rawBody = await req.text();

  if (
    SIGNING_KEY &&
    !verifySignature(rawBody, req.headers.get("calendly-webhook-signature"))
  ) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const result = await handleCalendlyEvent(body);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[upsell-calls-webhook]", (e as Error).message);
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 200 },
    );
  }
}

// Health check — confirms the route is live and env wired, no secrets.
export async function GET() {
  return NextResponse.json({
    ok: true,
    signing_key_configured: Boolean(SIGNING_KEY),
    airtable_token_configured: Boolean(process.env.AIRTABLE_TOKEN),
  });
}

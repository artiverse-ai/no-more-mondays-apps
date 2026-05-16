#!/usr/bin/env node
/**
 * Register the Calendly webhook subscription that points at our
 * /api/calendly-webhook endpoint. Run once after deploying the route.
 *
 * Usage:
 *   CALENDLY_PAT=<token> \
 *   WEBHOOK_URL=https://no-more-mondays-apps.vercel.app/api/calendly-webhook \
 *     node scripts/register-calendly-webhook.mjs
 *
 * Output: prints the new subscription's URI + signing_key. Take the
 * signing_key and add it to Vercel as the CALENDLY_WEBHOOK_SIGNING_KEY
 * env var (Project → Settings → Environment Variables).
 *
 * List existing subscriptions:
 *   ACTION=list node scripts/register-calendly-webhook.mjs
 * Delete a subscription:
 *   ACTION=delete SUBSCRIPTION_URI=<uri> node scripts/register-calendly-webhook.mjs
 */

const PAT = process.env.CALENDLY_PAT;
const WEBHOOK_URL = process.env.WEBHOOK_URL ?? "https://no-more-mondays-apps.vercel.app/api/calendly-webhook";
const ACTION = process.env.ACTION ?? "create";

if (!PAT) {
  console.error("ERROR: set CALENDLY_PAT env var");
  process.exit(1);
}

const CALENDLY_BASE = "https://api.calendly.com";

async function call(method, path, body) {
  const url = path.startsWith("http") ? path : `${CALENDLY_BASE}${path}`;
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${PAT}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Calendly ${res.status} ${method} ${path}:`, text);
    process.exit(1);
  }
  return text ? JSON.parse(text) : null;
}

async function main() {
  const me = await call("GET", "/users/me");
  const orgUri = me.resource.current_organization;
  const userUri = me.resource.uri;
  console.log(`[webhook] org: ${orgUri}`);

  if (ACTION === "list") {
    const subs = await call("GET", `/webhook_subscriptions?organization=${encodeURIComponent(orgUri)}&scope=organization`);
    console.log("[webhook] existing subscriptions:");
    for (const s of subs.collection ?? []) {
      console.log(`  ${s.uri} → ${s.callback_url} (events: ${s.events.join(", ")}, state: ${s.state})`);
    }
    return;
  }

  if (ACTION === "delete") {
    const sub = process.env.SUBSCRIPTION_URI;
    if (!sub) { console.error("ERROR: set SUBSCRIPTION_URI"); process.exit(1); }
    await call("DELETE", sub);
    console.log(`[webhook] deleted ${sub}`);
    return;
  }

  // ACTION === "create"
  console.log(`[webhook] subscribing ${WEBHOOK_URL} ...`);
  const result = await call("POST", "/webhook_subscriptions", {
    url: WEBHOOK_URL,
    events: [
      "invitee.created",
      "invitee.canceled",
      "invitee_no_show.created",
      "invitee_no_show.deleted",
    ],
    organization: orgUri,
    user: userUri,
    scope: "organization",
  });

  console.log("[webhook] ✅ created");
  console.log(`  URI:         ${result.resource.uri}`);
  console.log(`  Callback:    ${result.resource.callback_url}`);
  console.log(`  Events:      ${result.resource.events.join(", ")}`);
  console.log(`  State:       ${result.resource.state}`);
  console.log("");
  console.log("⚠ IMPORTANT — copy this signing key into Vercel env var");
  console.log("  CALENDLY_WEBHOOK_SIGNING_KEY:");
  console.log("");
  console.log(`  ${result.resource.signing_key ?? "(check Calendly dashboard — Calendly may not return signing_key in this response)"}`);
  console.log("");
}

main().catch((e) => {
  console.error("[webhook] fatal:", e);
  process.exit(1);
});

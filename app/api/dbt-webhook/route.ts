// dbt Cloud webhook → Slack relay.
//
// dbt Cloud webhooks POST dbt's own JSON schema, which a Slack incoming
// webhook can't parse (it expects {"text": ...}) — pointing dbt straight
// at the Slack URL returns HTTP 400. This route is the translator: it
// verifies dbt's HMAC signature, reformats the payload into a Slack
// message, @-mentions the on-call folks on failures, and forwards it to
// the Slack incoming webhook for #data-pipeline-alert.
//
// Setup (one-time):
//   1. Set env vars on Vercel:
//        DBT_WEBHOOK_SECRET     — the webhook signing key from dbt Cloud
//        DBT_SLACK_WEBHOOK_URL  — Slack incoming webhook for the channel
//        DBT_ACCOUNT_HOST       — (optional) dbt host, for run links
//   2. In dbt Cloud → Webhooks, set the webhook Endpoint to
//        https://no-more-mondays-apps.vercel.app/api/dbt-webhook
//
// We always return 200 (even on a Slack hiccup) so dbt doesn't disable
// the webhook after repeated non-2xx responses — failures are logged.

import { NextResponse } from "next/server";
import crypto from "node:crypto";

export const dynamic = "force-dynamic";

const DBT_WEBHOOK_SECRET = process.env.DBT_WEBHOOK_SECRET ?? "";
const SLACK_WEBHOOK_URL = process.env.DBT_SLACK_WEBHOOK_URL ?? "";
const DBT_HOST = process.env.DBT_ACCOUNT_HOST ?? "pe630.us1.dbt.com";

// Slack member IDs @-mentioned on a failed run. Same people as the
// Fivetran/Airbyte pipeline alerts: Shahriar, Taziem.
const MENTION_IDS = ["U0B39GWBQ78", "U09BYUF1NAE"];

// dbt Cloud signs each delivery with HMAC-SHA256 over the raw request
// body, keyed with the webhook secret. The hex digest is sent in the
// `Authorization` header.
function verifySignature(rawBody: string, authHeader: string | null): boolean {
  if (!DBT_WEBHOOK_SECRET || !authHeader) return false;
  const computed = crypto
    .createHmac("sha256", DBT_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(authHeader),
      Buffer.from(computed),
    );
  } catch {
    return false; // length mismatch → not a valid signature
  }
}

type DbtWebhookPayload = {
  accountId?: number;
  eventType?: string; // job.run.started | job.run.completed | job.run.errored
  data?: {
    jobName?: string;
    runId?: string;
    projectId?: string;
    projectName?: string;
    environmentName?: string;
    runStatus?: string; // Errored | Success | Cancelled | ...
    runStatusMessage?: string;
    runReason?: string;
    runDurationHumanized?: string;
  };
};

// We only alert on failed runs — successes and run-started events are
// dropped (see POST). dbt's "Test endpoint" button sends a Success
// sample, so a test won't post to Slack; that's intended.
function isFailedRun(p: DbtWebhookPayload): boolean {
  return (
    p.eventType === "job.run.errored" || p.data?.runStatus === "Errored"
  );
}

function truncate(s: string, max = 500): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function buildSlackText(p: DbtWebhookPayload): string {
  const d = p.data ?? {};
  const mentions = MENTION_IDS.map((id) => `<@${id}>`).join(" ");

  const runUrl =
    p.accountId && d.projectId && d.runId
      ? `https://${DBT_HOST}/deploy/${p.accountId}/projects/${d.projectId}/runs/${d.runId}`
      : null;

  const lines = [`🔴 *dbt job failed* ${mentions}`];
  if (d.jobName) lines.push(`*Job:* ${d.jobName}`);
  if (d.projectName) lines.push(`*Project:* ${d.projectName}`);
  if (d.environmentName) lines.push(`*Environment:* ${d.environmentName}`);
  if (d.runStatus) lines.push(`*Status:* ${d.runStatus}`);
  if (d.runReason) lines.push(`*Reason:* ${truncate(d.runReason, 200)}`);
  if (d.runStatusMessage)
    lines.push(`*Message:* ${truncate(d.runStatusMessage)}`);
  if (d.runDurationHumanized)
    lines.push(`*Duration:* ${d.runDurationHumanized}`);
  if (runUrl) lines.push(`*Run:* <${runUrl}|#${d.runId}>`);

  return lines.join("\n");
}

export async function POST(req: Request) {
  const rawBody = await req.text();

  // Signature check is enforced whenever the secret is configured. In a
  // bare dev environment (no secret set) we accept anything so local
  // curl tests work.
  if (
    DBT_WEBHOOK_SECRET &&
    !verifySignature(rawBody, req.headers.get("authorization"))
  ) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: DbtWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as DbtWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Failures only. Successes, run-started events, and dbt's "Test
  // endpoint" sample (which is always a Success) are acknowledged with
  // 200 but never forwarded to Slack.
  if (!isFailedRun(payload)) {
    return NextResponse.json({ ok: true, skipped: "not a failed run" });
  }

  if (!SLACK_WEBHOOK_URL) {
    console.error("[dbt-webhook] DBT_SLACK_WEBHOOK_URL not set");
    return NextResponse.json(
      { ok: false, error: "Slack webhook URL not configured" },
      { status: 200 },
    );
  }

  try {
    const res = await fetch(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: buildSlackText(payload) }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("[dbt-webhook] Slack rejected:", res.status, body);
      return NextResponse.json(
        { ok: false, slack_status: res.status },
        { status: 200 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[dbt-webhook] forward failed:", (e as Error).message);
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 200 },
    );
  }
}

// Health check — confirms the route is live and env is wired, without
// leaking secret values.
export async function GET() {
  return NextResponse.json({
    ok: true,
    secret_configured: Boolean(DBT_WEBHOOK_SECRET),
    slack_configured: Boolean(SLACK_WEBHOOK_URL),
  });
}

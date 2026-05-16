// Enriches Calendly bookings with NMM's downstream call data — held/no-show
// status, deal/cash outcome, closer attribution. Joins on
// (prospect_email_lc, calendly_created_ts) into dbt_tuddin.int_calls_enriched.
//
// Used by /apps/calendly-call-creation-stats AFTER the Calendly API fetch
// completes. Endpoint is POST-only because the email list can be large.

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { bq } from "@/lib/bq";

const PROJECT = process.env.BQ_PROJECT || "no-more-mondays-analytics";
const ENRICHED = `\`${PROJECT}.dbt_tuddin.int_calls_enriched\``;

export const dynamic = "force-dynamic";

export type EnrichedRow = {
  emailLc: string;
  createdAtIso: string;          // calendly_created_ts in BQ, ISO string
  isCallHeld: boolean | null;     // disposition'd by closer
  isNotTaken: boolean | null;     // call passed, no disposition
  isShowUp: boolean | null;
  isDispositioned: boolean | null;
  isCanceled: boolean | null;
  isDeal: boolean | null;
  cashCollected: number | null;
  revenueGenerated: number | null;
  closerOwner: string | null;
  setterOwner: string | null;
  callOutcome: string | null;
};

type Body = {
  // Lowercase invitee emails from the Calendly fetch.
  emails: string[];
  // ISO timestamps. The BQ join filters created_ts BETWEEN [createdMin, createdMax].
  createdMin: string;
  createdMax: string;
};

export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const emails = Array.from(new Set((body.emails ?? []).map((e) => e.toLowerCase().trim()).filter(Boolean)));
  if (emails.length === 0) {
    return NextResponse.json({ rows: [] });
  }
  if (!body.createdMin || !body.createdMax) {
    return NextResponse.json({ error: "createdMin + createdMax required" }, { status: 400 });
  }

  const sql = `SELECT
    LOWER(prospect_email_lc)                            AS email_lc,
    FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', calendly_created_ts, 'UTC')
                                                        AS created_at_iso,
    is_call_held,
    is_not_taken,
    is_show_up,
    is_dispositioned,
    is_canceled,
    is_deal,
    cash_collected,
    revenue_generated,
    closer_owner,
    setter_owner,
    call_outcome
  FROM ${ENRICHED}
  WHERE LOWER(prospect_email_lc) IN UNNEST(@emails)
    AND calendly_created_ts BETWEEN TIMESTAMP(@createdMin) AND TIMESTAMP(@createdMax)`;

  // Resolved-SQL string for the Dev Mode info button. Caps the email list
  // preview so the modal stays readable when the user has thousands of rows.
  const previewEmails = emails.slice(0, 50);
  const emailLiteral = `[${previewEmails.map((e) => `'${e.replace(/'/g, "''")}'`).join(", ")}${emails.length > 50 ? `, /* + ${emails.length - 50} more */` : ""}]`;
  const resolvedSql = sql
    .replace("@emails", emailLiteral)
    .replace("@createdMin", `'${body.createdMin}'`)
    .replace("@createdMax", `'${body.createdMax}'`);

  try {
    const [rows] = await bq().query({
      query: sql,
      params: { emails, createdMin: body.createdMin, createdMax: body.createdMax },
      types: { emails: ["STRING"], createdMin: "STRING", createdMax: "STRING" },
    });

    const enriched: EnrichedRow[] = (rows as Record<string, unknown>[]).map((r) => ({
      emailLc: String(r.email_lc ?? ""),
      createdAtIso: String(r.created_at_iso ?? ""),
      isCallHeld: r.is_call_held == null ? null : Boolean(r.is_call_held),
      isNotTaken: r.is_not_taken == null ? null : Boolean(r.is_not_taken),
      isShowUp: r.is_show_up == null ? null : Boolean(r.is_show_up),
      isDispositioned: r.is_dispositioned == null ? null : Boolean(r.is_dispositioned),
      isCanceled: r.is_canceled == null ? null : Boolean(r.is_canceled),
      isDeal: r.is_deal == null ? null : Boolean(r.is_deal),
      cashCollected: r.cash_collected == null ? null : Number(r.cash_collected),
      revenueGenerated: r.revenue_generated == null ? null : Number(r.revenue_generated),
      closerOwner: r.closer_owner ? String(r.closer_owner) : null,
      setterOwner: r.setter_owner ? String(r.setter_owner) : null,
      callOutcome: r.call_outcome ? String(r.call_outcome) : null,
    }));

    return NextResponse.json({
      rows: enriched,
      sql: resolvedSql,
      stats: {
        emailsQueried: emails.length,
        rowsReturned: enriched.length,
        createdMin: body.createdMin,
        createdMax: body.createdMax,
      },
    });
  } catch (e) {
    return NextResponse.json({
      error: (e as Error).message,
      sql: resolvedSql,
      stats: { emailsQueried: emails.length, createdMin: body.createdMin, createdMax: body.createdMax },
    }, { status: 500 });
  }
}

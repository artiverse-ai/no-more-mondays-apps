// Temporary debug endpoint — explains why the closer board can show
// closed deals while the setter board shows 0 closed for the same
// window. Returns the raw fields for every deal closed in the current
// competition (week or all-time) so we can see whether the booking is
// pre-launch, missing a Calendly link, or attributed to a setter
// outside our 3-setter roster.
//
// Admin-gated. Safe to delete once the policy question is resolved.

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { bq } from "@/lib/bq";
import { COMPETITION_LAUNCH_TS } from "@/app/competition/_data/roster";
import { SETTER_ROSTER } from "@/app/competition/_data/setters";

export const dynamic = "force-dynamic";

const ENRICHED = "`no-more-mondays-analytics.dbt_tuddin.int_calls_enriched`";

export async function GET() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) {
    return NextResponse.json({ error: "admin only" }, { status: 403 });
  }

  // All deals closed since launch — same window as /competition?period=week
  // (week = May 24-30) but we relax to "since launch" to catch anything
  // the closer board has counted.
  const SQL = `
    SELECT
      closer_owner,
      FORMAT_DATE('%F', date_closed) AS date_closed,
      cash_collected,
      close_type,
      prospect_email_lc,
      setter_owner,
      calendly_setter_name,
      COALESCE(setter_owner, calendly_setter_name) AS resolved_setter,
      calendly_created_ts,
      airtable_created_date,
      CASE
        WHEN calendly_created_ts IS NULL THEN 'no_calendly_link'
        WHEN calendly_created_ts < TIMESTAMP('${COMPETITION_LAUNCH_TS}') THEN 'pre_launch'
        WHEN COALESCE(setter_owner, calendly_setter_name) NOT IN UNNEST(@setters)
          THEN 'setter_not_in_roster'
        ELSE 'in_window'
      END AS setter_credit_reason
    FROM ${ENRICHED}
    WHERE is_deal
      AND date_closed >= DATE('2026-05-24')
      AND closer_owner IS NOT NULL
    ORDER BY date_closed DESC, cash_collected DESC
  `;

  const [rows] = await bq().query({
    query: SQL,
    params: { setters: SETTER_ROSTER.map((s) => s.setter) },
    types: { setters: ["STRING"] },
  });

  const summary = {
    rosterSetters: SETTER_ROSTER.map((s) => s.setter),
    launchTs: COMPETITION_LAUNCH_TS,
    totalDeals: rows.length,
    byReason: rows.reduce<Record<string, number>>((acc, r) => {
      const k = String((r as Record<string, unknown>).setter_credit_reason);
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {}),
    deals: rows,
  };

  return NextResponse.json(summary, { status: 200 });
}

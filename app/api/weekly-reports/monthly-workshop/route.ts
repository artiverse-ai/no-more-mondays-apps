// Admin endpoint — create a monthly-workshop snapshot.
//
// Workshop reports differ from weekly recaps in that they are anchored on
// a specific workshop day (e.g. Sun May 31) with a report date that
// follows (e.g. Mon Jun 1). The retargeting tag names and reactivation
// cost are admin inputs because they're not derivable from BQ.
//
// POST body: {
//   slug:           "2026-06-01",      // the report's run-on Monday
//   workshopDate:   "2026-05-31",      // Sunday — workshop day
//   reactivationCost: 3000,            // optional, defaults to 0
//   retargetingEmailTag?: string,      // optional, defaults to
//                                      //   "retargeting: email: workshop-{workshopDate}"
//   retargetingSmsTag?:   string,      // optional, defaults to
//                                      //   "retargeting: sms: workshop-{workshopDate}"
// }
//
// Returns { slug } on success. The VM cron picks the new snapshot up
// within ~60s and generates insight cards.

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createSnapshot } from "@/lib/weekly-report-snapshots";

export const dynamic = "force-dynamic";

type Body = {
  slug?: string;
  workshopDate?: string;
  reactivationCost?: number | null;
  retargetingEmailTag?: string | null;
  retargetingSmsTag?: string | null;
  // Optional metadata overrides
  weekLabel?: string;
  badge?: string;
};

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function fmtNice(iso: string): string {
  // "Sun May 31, 2026"
  return new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return NextResponse.json({ error: "admin only" }, { status: 403 });

  let body: Body;
  try { body = (await req.json()) as Body; }
  catch { return NextResponse.json({ error: "invalid JSON body" }, { status: 400 }); }

  const slug = body.slug;
  const workshopDate = body.workshopDate;
  if (!slug || !/^\d{4}-\d{2}-\d{2}$/.test(slug)) {
    return NextResponse.json({ error: "slug (YYYY-MM-DD) required" }, { status: 400 });
  }
  if (!workshopDate || !/^\d{4}-\d{2}-\d{2}$/.test(workshopDate)) {
    return NextResponse.json({ error: "workshopDate (YYYY-MM-DD) required" }, { status: 400 });
  }

  const emailTag = body.retargetingEmailTag ?? `retargeting: email: workshop-${workshopDate}`;
  const smsTag   = body.retargetingSmsTag   ?? `retargeting: sms: workshop-${workshopDate}`;
  const reactivationCost = body.reactivationCost ?? 0;

  // KPI window for monthly workshop report: the Sun→Sat of the workshop
  // week. workshopDate is Sun → weekStart = workshopDate, weekEnd = +6.
  const weekStart = workshopDate;
  const weekEnd   = addDays(workshopDate, 6);
  const runOn     = slug; // slug IS the run date

  await createSnapshot({
    slug,
    runOn,
    weekStart,
    weekEnd,
    reportType: "monthly_workshop_recap",
    weekLabel: body.weekLabel ?? `Workshop week ${fmtNice(workshopDate)}`,
    badge:     body.badge     ?? `MON ${fmtNice(runOn).toUpperCase()} · MONTHLY`,
    latestWebinar: fmtNice(workshopDate),
    contextTag: null,
    contextTitle: null,
    contextBody: null,
    workshopTagDate: workshopDate,
    retargetingEmailTag: emailTag,
    retargetingSmsTag: smsTag,
    reactivationCost,
  });

  return NextResponse.json({
    slug,
    workshopDate,
    emailTag,
    smsTag,
    reactivationCost,
  }, { status: 201 });
}

// GET  → returns the proposed next snapshot + BQ data availability.
//        Any signed-in user can read this.
// POST → admin-only. Creates the snapshot if the proposal is "ready".
//        Refuses on "missing_data" or "exists".

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { determineNext } from "@/lib/next-snapshot";
import { createSnapshot } from "@/lib/weekly-report-snapshots";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    const result = await determineNext(new Date());
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!me.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const result = await determineNext(new Date());
    if (result.status === "exists") {
      return NextResponse.json(
        { error: `Snapshot ${result.proposed.slug} already exists` },
        { status: 409 },
      );
    }
    if (result.status === "missing_data") {
      return NextResponse.json(
        {
          error: `Cannot create yet — missing data: ${result.availability.missing.join(", ")}`,
          availability: result.availability,
        },
        { status: 422 },
      );
    }

    const p = result.proposed;
    await createSnapshot({
      slug: p.slug,
      runOn: p.runOn,
      weekStart: p.weekStart,
      weekEnd: p.weekEnd,
      reportType: p.reportType,
      weekLabel: p.weekLabel,
      badge: p.badge,
      latestWebinar: null,
      contextTag: null,
      contextTitle: null,
      contextBody: null,
    });
    return NextResponse.json({ ok: true, slug: p.slug });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

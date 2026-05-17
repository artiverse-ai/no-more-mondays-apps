// GET  → returns every Mon + Thu from the last 12 weeks (newest first) with
//        existing-snapshot + BQ-data-ready flags. Any signed-in user can read.
// POST → admin-only. Creates a snapshot for the provided runOn date (must be
//        a past or current Mon/Thu) iff data is ready and no snapshot exists.

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  bulkCheckAvailability,
  checkAvailability,
  enumerateMonThuRange,
  proposeFromRunDate,
  type ProposedSnapshot,
} from "@/lib/next-snapshot";
import { createSnapshot, getSnapshot, listSnapshots } from "@/lib/weekly-report-snapshots";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Proposal = ProposedSnapshot & {
  existing: boolean;
  dataReady: boolean;
  availability: { webinars: number; calls: number; missing: string[] };
};

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  try {
    const proposed = enumerateMonThuRange(new Date(), 52);
    const [existingSnapshots, availMap] = await Promise.all([
      listSnapshots(),
      bulkCheckAvailability(proposed.map((p) => ({ weekStart: p.weekStart, weekEnd: p.weekEnd }))),
    ]);
    const existingSlugs = new Set(existingSnapshots.map((s) => s.slug));
    const enriched: Proposal[] = proposed.map((p) => {
      const availability = availMap.get(`${p.weekStart}|${p.weekEnd}`) ?? {
        webinars: 0,
        calls: 0,
        missing: ["webinars", "calls"] as ("webinars" | "calls")[],
      };
      return {
        ...p,
        existing: existingSlugs.has(p.slug),
        dataReady: availability.missing.length === 0,
        availability,
      };
    });
    return NextResponse.json({ proposals: enriched });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!me.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { runOn?: string };
  try {
    body = (await req.json()) as { runOn?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const runOn = body.runOn;
  if (!runOn || !/^\d{4}-\d{2}-\d{2}$/.test(runOn)) {
    return NextResponse.json({ error: "runOn must be YYYY-MM-DD" }, { status: 400 });
  }

  let proposed: ProposedSnapshot;
  try {
    proposed = proposeFromRunDate(new Date(runOn + "T00:00:00Z"));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  try {
    const existing = await getSnapshot(proposed.slug);
    if (existing) {
      return NextResponse.json(
        { error: `Snapshot ${proposed.slug} already exists`, slug: proposed.slug },
        { status: 409 },
      );
    }
    const availability = await checkAvailability(proposed.weekStart, proposed.weekEnd);
    if (availability.missing.length > 0) {
      return NextResponse.json(
        {
          error: `Data not ready: missing ${availability.missing.join(", ")}`,
          availability,
        },
        { status: 422 },
      );
    }

    await createSnapshot({
      slug: proposed.slug,
      runOn: proposed.runOn,
      weekStart: proposed.weekStart,
      weekEnd: proposed.weekEnd,
      reportType: proposed.reportType,
      weekLabel: proposed.weekLabel,
      badge: proposed.badge,
      latestWebinar: proposed.latestWebinar,
      contextTag: null,
      contextTitle: null,
      contextBody: null,
    });
    return NextResponse.json({ ok: true, slug: proposed.slug });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

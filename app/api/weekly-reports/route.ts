// GET  → list snapshots (any signed-in user)
// POST → create a new snapshot (admin only)

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  createSnapshot,
  listSnapshots,
  type ReportType,
} from "@/lib/weekly-report-snapshots";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    const snapshots = await listSnapshots();
    return NextResponse.json({ snapshots });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!me.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as Partial<{
    slug: string;
    runOn: string;
    weekStart: string;
    weekEnd: string;
    reportType: ReportType;
    weekLabel: string;
    badge: string;
    latestWebinar: string;
    contextTag: string;
    contextTitle: string;
    contextBody: string;
  }>;

  const required = ["slug", "runOn", "weekStart", "weekEnd", "reportType", "weekLabel", "badge"] as const;
  for (const k of required) {
    if (!body[k] || typeof body[k] !== "string") {
      return NextResponse.json({ error: `Missing or invalid field: ${k}` }, { status: 400 });
    }
  }
  if (!SLUG_RE.test(body.slug!)) {
    return NextResponse.json(
      { error: "Slug must be lowercase letters/digits/hyphens, ≤64 chars" },
      { status: 400 },
    );
  }
  if (body.reportType !== "weekly_recap" && body.reportType !== "midweek_check") {
    return NextResponse.json({ error: "reportType must be weekly_recap or midweek_check" }, { status: 400 });
  }

  try {
    await createSnapshot({
      slug: body.slug!,
      runOn: body.runOn!,
      weekStart: body.weekStart!,
      weekEnd: body.weekEnd!,
      reportType: body.reportType,
      weekLabel: body.weekLabel!,
      badge: body.badge!,
      latestWebinar: body.latestWebinar ?? null,
      contextTag: body.contextTag ?? null,
      contextTitle: body.contextTitle ?? null,
      contextBody: body.contextBody ?? null,
    });
    return NextResponse.json({ ok: true, slug: body.slug });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

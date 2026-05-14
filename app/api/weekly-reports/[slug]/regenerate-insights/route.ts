// POST → mark a snapshot's insights for regeneration (admin only)
// The VM cron picks up snapshots with insights_generation_status='pending'
// and replaces the insight cards.

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSnapshot, resetInsightsGeneration } from "@/lib/weekly-report-snapshots";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!me.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { slug } = await ctx.params;

  const snap = await getSnapshot(slug);
  if (!snap) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await resetInsightsGeneration(slug);
    return NextResponse.json({ ok: true, status: "pending" });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

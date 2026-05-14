// GET  → list insights for a snapshot (any signed-in user)
// POST → create an insight (admin only)

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createInsight, listInsights } from "@/lib/weekly-report-snapshots";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const VALID_TONES = new Set(["ctx", "win", "watch", "flag", "fix", "fwd"]);

export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { slug } = await ctx.params;
  try {
    const insights = await listInsights(slug);
    return NextResponse.json({ insights });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!me.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { slug } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    tone?: string; tag?: string; title?: string; body?: string; position?: number;
  };
  if (!body.tone || !VALID_TONES.has(body.tone)) {
    return NextResponse.json({ error: "Invalid tone" }, { status: 400 });
  }
  if (!body.tag || !body.title || !body.body) {
    return NextResponse.json({ error: "tag, title, body required" }, { status: 400 });
  }
  try {
    const insight = await createInsight({
      snapshotSlug: slug,
      tone: body.tone,
      tag: body.tag,
      title: body.title,
      body: body.body,
      position: body.position,
    });
    return NextResponse.json({ insight });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

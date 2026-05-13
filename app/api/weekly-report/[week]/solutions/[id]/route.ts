// PATCH a solution — edit body. Same author/admin gate as DELETE.
// DELETE a solution — soft delete. Author or admin only.

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getSolution,
  softDeleteSolution,
  updateSolution,
} from "@/lib/weekly-report-solutions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function gate(
  id: string,
): Promise<
  | { ok: true; email: string; isAdmin: boolean; authorEmail: string }
  | { ok: false; res: NextResponse }
> {
  const me = await getCurrentUser();
  if (!me)
    return { ok: false, res: NextResponse.json({ error: "Unauthenticated" }, { status: 401 }) };
  const existing = await getSolution(id);
  if (!existing)
    return { ok: false, res: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  const isAuthor = me.email.toLowerCase() === existing.authorEmail.toLowerCase();
  if (!isAuthor && !me.isAdmin) {
    return { ok: false, res: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true, email: me.email, isAdmin: me.isAdmin, authorEmail: existing.authorEmail };
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ week: string; id: string }> },
) {
  const { id } = await context.params;
  const g = await gate(id);
  if (!g.ok) return g.res;

  const body = (await req.json().catch(() => ({}))) as { body?: string };
  const text = (body.body ?? "").trim();
  if (!text) return NextResponse.json({ error: "Empty body" }, { status: 400 });
  if (text.length > 5000) {
    return NextResponse.json({ error: "Too long (max 5000 chars)" }, { status: 400 });
  }

  try {
    const updated = await updateSolution(id, text);
    if (!updated)
      return NextResponse.json({ error: "Not found after update" }, { status: 404 });
    return NextResponse.json({ solution: updated });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ week: string; id: string }> },
) {
  const { id } = await context.params;
  const g = await gate(id);
  if (!g.ok) return g.res;

  try {
    await softDeleteSolution(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    );
  }
}

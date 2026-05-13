// DELETE a solution — author can delete their own; admins can delete anything.

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getSolution,
  softDeleteSolution,
} from "@/lib/weekly-report-solutions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ week: string; id: string }> },
) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { id } = await context.params;

  const existing = await getSolution(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAuthor = me.email.toLowerCase() === existing.authorEmail.toLowerCase();
  if (!isAuthor && !me.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

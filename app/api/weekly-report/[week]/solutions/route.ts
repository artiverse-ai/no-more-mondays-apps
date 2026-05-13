// GET  → list solutions for a (week, tab) — any signed-in user
// POST → create a solution — only the tab's editor or an admin

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  createSolution,
  editorFor,
  listSolutions,
  SolutionTab,
} from "@/lib/weekly-report-solutions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function parseTab(value: string | null): SolutionTab | null {
  if (value === "marketing" || value === "sales") return value;
  return null;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ week: string }> },
) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { week } = await context.params;
  const tab = parseTab(req.nextUrl.searchParams.get("tab"));
  if (!tab) return NextResponse.json({ error: "Missing tab" }, { status: 400 });
  try {
    const solutions = await listSolutions(week, tab);
    return NextResponse.json({ solutions });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    );
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ week: string }> },
) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { week } = await context.params;
  const body = (await req.json().catch(() => ({}))) as {
    tab?: string;
    body?: string;
    authorName?: string;
  };
  const tab = parseTab(body.tab ?? null);
  if (!tab) return NextResponse.json({ error: "Missing tab" }, { status: 400 });

  const text = (body.body ?? "").trim();
  if (!text) return NextResponse.json({ error: "Empty body" }, { status: 400 });
  if (text.length > 5000) {
    return NextResponse.json({ error: "Too long (max 5000 chars)" }, { status: 400 });
  }

  // Permission: must be the tab's editor OR an admin.
  const editorEmail = editorFor(tab);
  const isEditor = me.email.toLowerCase() === editorEmail;
  if (!isEditor && !me.isAdmin) {
    return NextResponse.json(
      { error: `Only ${editorEmail} or an admin can post here.` },
      { status: 403 },
    );
  }

  try {
    const solution = await createSolution({
      reportWeek: week,
      tab,
      authorEmail: me.email,
      authorName: body.authorName?.trim() || null,
      body: text,
    });
    return NextResponse.json({ solution });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    );
  }
}

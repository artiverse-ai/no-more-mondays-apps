// Closer roster split by is_active. Used by the Strategy Calls dashboard so
// the in-app filter can scope by Active / Inactive closer without round-
// tripping a BQ query per filter toggle. Live (no cache) — the roster is
// edited from /admin/closers and we want changes visible immediately.

import { NextResponse } from "next/server";
import { getClosers } from "@/lib/closers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const closers = await getClosers();
    const active: string[] = [];
    const inactive: string[] = [];
    for (const c of closers) {
      const email = c.email.toLowerCase();
      if (c.is_active) active.push(email);
      else inactive.push(email);
    }
    active.sort();
    inactive.sort();
    return NextResponse.json({ active, inactive });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}

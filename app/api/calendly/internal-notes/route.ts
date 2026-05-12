// Distinct internal_note values across every event type in the org.
// Powers the multi-select on the Calendly Internal Note Search page.
//
// Runs the same Phases 1-3 the client pipeline runs (users/me →
// organization_memberships → /event_types?user=<uri>), then collapses to the
// unique non-empty internal_note set. Lives behind the same auth as the rest
// of the app; CALENDLY_PAT stays server-side.

import { NextResponse } from "next/server";

const CALENDLY_BASE = "https://api.calendly.com";
const CONCURRENCY = 8;

// No caching — the user wants live funnel data on every page load, so any
// new internal_note added in Calendly shows up immediately.
export const dynamic = "force-dynamic";
export const revalidate = 0;

type EventType = {
  uri: string;
  internal_note?: string | null;
  deleted_at?: string | null;
};

async function call<T>(
  pat: string,
  path: string,
  params: Record<string, string | number | undefined> = {},
): Promise<T> {
  const url = new URL(CALENDLY_BASE + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Calendly ${path} ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

async function paginate<T>(
  pat: string,
  path: string,
  params: Record<string, string | number | undefined> = {},
): Promise<T[]> {
  const out: T[] = [];
  let token: string | null = null;
  do {
    const p: Record<string, string | number | undefined> = { ...params, count: 100 };
    if (token) p.page_token = token;
    const data: { collection?: T[]; pagination?: { next_page_token?: string | null } } =
      await call(pat, path, p);
    out.push(...(data.collection ?? []));
    token = data.pagination?.next_page_token ?? null;
  } while (token);
  return out;
}

// Same shared-cursor pool the client uses.
async function pool<In>(items: In[], task: (item: In) => Promise<void>) {
  let i = 0;
  const worker = async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      try {
        await task(items[idx]);
      } catch {
        // Per-user failures are tolerated — we'd rather return the partial
        // distinct set than 500 the whole page.
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker),
  );
}

export async function GET() {
  const pat = process.env.CALENDLY_PAT;
  if (!pat) {
    return NextResponse.json(
      { error: "CALENDLY_PAT not configured" },
      { status: 500 },
    );
  }

  try {
    const me = await call<{ resource: { current_organization?: string } }>(pat, "/users/me");
    const orgUri = me.resource?.current_organization;
    if (!orgUri) {
      return NextResponse.json(
        { error: "PAT is missing admin scope (no current_organization)" },
        { status: 500 },
      );
    }

    const memberships = await paginate<{ user?: { uri?: string } | string }>(
      pat,
      "/organization_memberships",
      { organization: orgUri },
    );
    const userUris = memberships
      .map((m) => (typeof m.user === "string" ? m.user : m.user?.uri ?? null))
      .filter((u): u is string => Boolean(u));

    const notes = new Set<string>();
    await pool(userUris, async (userUri) => {
      const ets = await paginate<EventType>(pat, "/event_types", { user: userUri });
      for (const et of ets) {
        if (et.deleted_at) continue;
        const n = (et.internal_note ?? "").trim();
        if (n) notes.add(n);
      }
    });

    const sorted = [...notes].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
    return NextResponse.json({ notes: sorted });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 502 },
    );
  }
}

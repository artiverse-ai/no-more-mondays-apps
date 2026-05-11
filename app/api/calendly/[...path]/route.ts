// Calendly API proxy.
// Browser hits /api/calendly/<path>; server adds the bearer PAT and forwards to
// https://api.calendly.com/<path>. Gated by Vercel Authentication (cookie-based)
// for the whole project — no separate ACCESS_KEY.
//
// Required env: CALENDLY_PAT — admin Personal Access Token.

import { NextResponse } from "next/server";

const CALENDLY_BASE = "https://api.calendly.com";

// Whitelisted Calendly endpoints. Match the Worker exactly. We also allow
// nested paths under each prefix (e.g. /scheduled_events/<uuid>/invitees).
const ALLOWED_PREFIXES = [
  "/users/me",
  "/event_types",
  "/scheduled_events",
  "/organizations",
  "/organization_memberships",
];

function isAllowed(path: string): boolean {
  return ALLOWED_PREFIXES.some(
    (p) => path === p || path.startsWith(p + "/") || path.startsWith(p + "?"),
  );
}

async function handle(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const pat = process.env.CALENDLY_PAT;
  if (!pat) {
    return NextResponse.json(
      { error: "CALENDLY_PAT not configured" },
      { status: 500 },
    );
  }

  const { path } = await context.params;
  const forwardPath = "/" + (path ?? []).join("/");
  if (!isAllowed(forwardPath)) {
    return NextResponse.json(
      { error: `Path not allowed: ${forwardPath}` },
      { status: 403 },
    );
  }

  // Carry query string through.
  const incoming = new URL(request.url);
  const upstream = new URL(CALENDLY_BASE + forwardPath);
  incoming.searchParams.forEach((v, k) => upstream.searchParams.set(k, v));

  try {
    const upstreamRes = await fetch(upstream.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${pat}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      // Calendly responses change frequently; don't let Next or the platform
      // cache them.
      cache: "no-store",
    });
    const body = await upstreamRes.text();
    return new Response(body, {
      status: upstreamRes.status,
      headers: {
        "Content-Type": "application/json",
        "X-RateLimit-Remaining":
          upstreamRes.headers.get("X-RateLimit-Remaining") || "",
        "X-RateLimit-Reset":
          upstreamRes.headers.get("X-RateLimit-Reset") || "",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Upstream request failed", detail: String(err) },
      { status: 502 },
    );
  }
}

export const GET = handle;

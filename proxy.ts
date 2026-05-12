// Gate the whole site by Cloudflare Access. When SKIP_AUTH=1, the gate is
// bypassed (use this during initial deploys before CF Access is configured).
// Once CF Access is in front of the custom domain, requests carrying the
// `Cf-Access-Authenticated-User-Email` header are let through; everything
// else is redirected to the custom domain (or 401 if already on it).

import { NextRequest, NextResponse } from "next/server";

const CF_HEADER = "cf-access-authenticated-user-email";

// Paths that stay public even when Cloudflare Access is enabled. The closer
// SOP is read by every closer in onboarding — most of them aren't going to be
// on the CF Access allow-list (which is scoped to ops + admins).
const PUBLIC_PATH_PREFIXES = ["/sops/closer-calendar-management"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

export function proxy(req: NextRequest) {
  if (process.env.SKIP_AUTH === "1") return NextResponse.next();

  if (isPublicPath(req.nextUrl.pathname)) return NextResponse.next();

  const email = req.headers.get(CF_HEADER);
  if (email) return NextResponse.next();

  const customDomain = process.env.CUSTOM_DOMAIN;
  if (customDomain && req.nextUrl.host !== customDomain) {
    const dest = new URL(
      req.nextUrl.pathname + req.nextUrl.search,
      `https://${customDomain}`,
    );
    return NextResponse.redirect(dest, 307);
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "Content-Type": "text/plain" },
  });
}

export const config = {
  matcher: [
    // Skip Next internals and static assets so the bundle still loads on the
    // login redirect target.
    "/((?!_next/|favicon\\.ico|robots\\.txt|sitemap\\.xml).*)",
  ],
};

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server";

// Public-by-design routes — bypass Clerk auth even when the gate is on.
// The closer SOP is consumed by every closer in onboarding (who almost
// certainly won't be signed up for the app), so it stays open.
//
// /competition is also public — closers see the live leaderboard
// (Beast/Games dashboard) and most don't have nomoremondays.io clerk
// accounts. Includes /competition/poster.png and other static assets
// served from /public/competition/ which would otherwise hit the auth
// gate by virtue of their URL prefix.
const isPublic = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/access-denied",
  "/sops/closer-calendar-management(.*)",
  "/competition(.*)",
  // External webhook receivers — called by third-party services that
  // can't carry a Clerk session. Each verifies its own HMAC signature,
  // so the Clerk gate must NOT redirect them to sign-in.
  "/api/calendly-webhook",
  "/api/dbt-webhook",
  "/api/upsell-calls-webhook",
]);

const handler = clerkMiddleware(async (auth, req) => {
  if (isPublic(req)) return;
  // `auth.protect()` returns 404 by default for unauth'd requests. For UI
  // routes we want the visitor sent to the sign-in page instead.
  //
  // NOTE: this gate only checks that the visitor is signed in. Restricting
  // *which* accounts may sign up belongs in the Clerk dashboard
  // (Restrictions → allowlist-only sign-ups) — a previous middleware-side
  // allowlist check locked out legitimate users and was reverted.
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn();
});

export default function proxy(req: NextRequest, event: NextFetchEvent) {
  // SKIP_AUTH or pre-Clerk: site is wide open. Once Clerk env is set and
  // SKIP_AUTH is removed, the gate kicks in.
  if (process.env.SKIP_AUTH === "1") return NextResponse.next();
  if (!process.env.CLERK_SECRET_KEY) return NextResponse.next();
  return handler(req, event);
}

export const config = {
  matcher: [
    // Skip Next internals and static assets so the bundle still loads on the
    // sign-in redirect target.
    "/((?!_next/|favicon\\.ico|robots\\.txt|sitemap\\.xml).*)",
  ],
};

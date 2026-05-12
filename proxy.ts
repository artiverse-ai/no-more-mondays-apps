import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server";

// Public-by-design routes — bypass Clerk auth even when the gate is on.
// The closer SOP is consumed by every closer in onboarding (who almost
// certainly won't be signed up for the app), so it stays open.
const isPublic = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/sops/closer-calendar-management(.*)",
]);

const handler = clerkMiddleware(async (auth, req) => {
  if (!isPublic(req)) await auth.protect();
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

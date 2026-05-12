// Helpers for reading the visitor's identity from the Cloudflare Access
// reverse-proxy headers. Cloudflare sets these on every request that passed
// through an Access policy:
//
//   Cf-Access-Authenticated-User-Email   verified email
//   CF_Authorization                     signed JWT (cookie)
//
// We trust the header on the custom domain because requests only reach the
// origin via Cloudflare. On the bare *.vercel.app URL these headers are
// absent, and middleware.ts redirects to the custom domain.

import { headers } from "next/headers";

export type CurrentUser = {
  email: string;
  isAdmin: boolean;
};

export const HEADER_EMAIL = "cf-access-authenticated-user-email";

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  // SKIP_AUTH mode: Cloudflare Access isn't fronting the app yet, so there's
  // no CF identity header. To keep /admin reachable in this transitional
  // state, surface the first ADMIN_EMAILS entry as a synthetic admin user.
  // Once CF Access is enabled and SKIP_AUTH is removed, only requests
  // carrying the real CF header are honored.
  if (process.env.SKIP_AUTH === "1") {
    const admins = adminEmails();
    if (admins.length > 0) {
      return { email: admins[0], isAdmin: true };
    }
    return null;
  }

  const h = await headers();
  const raw = h.get(HEADER_EMAIL);
  if (!raw) return null;
  const email = raw.toLowerCase();
  return { email, isAdmin: adminEmails().includes(email) };
}

export async function requireAdmin(): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) throw new Error("Not authenticated");
  if (!u.isAdmin) throw new Error("Not authorized");
  return u;
}

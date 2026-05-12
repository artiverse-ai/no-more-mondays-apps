// Current-user helpers. Sources identity from Clerk in production; falls
// back to a synthetic admin in SKIP_AUTH mode or when Clerk isn't yet
// configured (so /admin remains reachable during initial setup).
//
// This replaces the old lib/cf-access.ts. ADMIN_EMAILS still drives the
// isAdmin flag — same env var, same semantics, different identity source.

import { currentUser } from "@clerk/nextjs/server";

export type CurrentUser = {
  email: string;
  isAdmin: boolean;
};

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function isClerkConfigured(): boolean {
  return Boolean(process.env.CLERK_SECRET_KEY);
}

function syntheticAdmin(): CurrentUser | null {
  const admins = adminEmails();
  if (admins.length === 0) return null;
  return { email: admins[0], isAdmin: true };
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  // Bypass while wiring up Clerk: every visitor becomes the first admin.
  // Once CLERK_SECRET_KEY is set and SKIP_AUTH is removed, the real Clerk
  // session is used.
  if (process.env.SKIP_AUTH === "1") return syntheticAdmin();
  if (!isClerkConfigured()) return syntheticAdmin();

  try {
    const u = await currentUser();
    if (!u) return null;
    const email = u.primaryEmailAddress?.emailAddress?.toLowerCase() ?? "";
    if (!email) return null;
    return { email, isAdmin: adminEmails().includes(email) };
  } catch {
    return null;
  }
}

export async function requireAdmin(): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) throw new Error("Not authenticated");
  if (!u.isAdmin) throw new Error("Not authorized");
  return u;
}

// Current-user helpers. Identity from Clerk; admin-ness from either the
// ADMIN_EMAILS env var (the bootstrap admins, baked at deploy time) OR
// Clerk's user publicMetadata.role === "admin" (set via /admin/access).
//
// Bootstrap admins are immutable from the UI — they're who you trust to be
// admin no matter what state Clerk is in. Anyone else gets admin only when
// an existing admin promotes them.

import { cache } from "react";
import { currentUser } from "@clerk/nextjs/server";

export type CurrentUser = {
  email: string;
  isAdmin: boolean;
};

function bootstrapAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function isClerkConfigured(): boolean {
  return Boolean(process.env.CLERK_SECRET_KEY);
}

function syntheticAdmin(): CurrentUser | null {
  const admins = bootstrapAdminEmails();
  if (admins.length === 0) return null;
  return { email: admins[0], isAdmin: true };
}

// `cache()` dedupes the call within a single request. Layouts + pages both
// call getCurrentUser; without cache that's 2-3 Clerk round-trips per page
// render. With cache it's exactly one.
export const getCurrentUser = cache(
  async (): Promise<CurrentUser | null> => {
    if (process.env.SKIP_AUTH === "1") return syntheticAdmin();
    if (!isClerkConfigured()) return syntheticAdmin();

    try {
      const u = await currentUser();
      if (!u) return null;
      const email = u.primaryEmailAddress?.emailAddress?.toLowerCase() ?? "";
      if (!email) return null;
      const meta = (u.publicMetadata ?? {}) as { role?: string };
      const isAdmin =
        bootstrapAdminEmails().includes(email) || meta.role === "admin";
      return { email, isAdmin };
    } catch {
      return null;
    }
  },
);

export async function requireAdmin(): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) throw new Error("Not authenticated");
  if (!u.isAdmin) throw new Error("Not authorized");
  return u;
}

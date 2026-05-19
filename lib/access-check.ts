// Defense-in-depth allowlist enforcement. Clerk's dev instance does not
// stop sign-ups for emails outside the allowlist — anyone with a Google
// account can create a Clerk user. So we re-check on every protected
// request: the signed-in user's email must be in ADMIN_EMAILS OR match
// a Clerk allowlist identifier (exact match or "*@domain" wildcard).
//
// Production-mode Clerk instances configured with "allowlist-only
// sign-ups" don't need this — but having it here means dev / staging
// stays locked even when the dashboard isn't.

import { clerkClient } from "@clerk/nextjs/server";

type AllowlistRow = { id: string; identifier?: string };

// 60s cache on the allowlist so we're not hammering Clerk on every page
// nav. The /admin/access page changes the allowlist — that takes up to
// 60s to propagate, which is fine for an internal tool.
let cache: { at: number; identifiers: string[] } | null = null;
const TTL_MS = 60_000;

async function fetchAllowlist(): Promise<string[]> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.identifiers;
  try {
    const client = await clerkClient();
    const res = await client.allowlistIdentifiers.getAllowlistIdentifierList();
    const rows: AllowlistRow[] = Array.isArray(res)
      ? (res as AllowlistRow[])
      : ((res as { data?: AllowlistRow[] }).data ?? []);
    const identifiers = rows
      .map((r) => r.identifier?.toLowerCase() ?? "")
      .filter(Boolean);
    cache = { at: now, identifiers };
    return identifiers;
  } catch {
    // If Clerk is unreachable we fail closed — return whatever was last
    // cached, or empty (denies everyone except bootstrap admins).
    return cache?.identifiers ?? [];
  }
}

function bootstrapAdmins(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function matchesIdentifier(email: string, identifier: string): boolean {
  if (identifier.startsWith("*@")) {
    return email.endsWith(identifier.slice(1)); // "*@example.com" → "@example.com"
  }
  return email === identifier;
}

/** True iff `email` is allowed to access the app. */
export async function isEmailAllowed(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  if (bootstrapAdmins().includes(normalized)) return true;
  const identifiers = await fetchAllowlist();
  return identifiers.some((id) => matchesIdentifier(normalized, id));
}

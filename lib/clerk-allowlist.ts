// Read/write the Clerk allowlist — the source of truth for who can sign in.
//
// Clerk's "Restrictions" feature (enabled in the Clerk dashboard at
// User & authentication → Restrictions → Allowlist) gates sign-up/sign-in
// to identifiers listed here. This module provides the CRUD that the
// /admin/access UI uses.
//
// If Restrictions isn't enabled in the Clerk dashboard, this list is still
// editable but isn't enforced. Toggling Restrictions on in the dashboard
// makes it live without any code change.

import { clerkClient } from "@clerk/nextjs/server";

export type Allowed = {
  id: string;
  identifier: string; // email
  invitationId?: string | null;
};

type AllowlistRow = {
  id: string;
  identifier?: string;
  invitation_id?: string | null;
  invitationId?: string | null;
};

export async function getAllowed(): Promise<Allowed[]> {
  const client = await clerkClient();
  const res = await client.allowlistIdentifiers.getAllowlistIdentifierList();
  const rows: AllowlistRow[] = (res as unknown as { data?: AllowlistRow[] }).data
    ?? (res as unknown as AllowlistRow[]);
  return rows
    .filter((r) => r.identifier)
    .map((r) => ({
      id: r.id,
      identifier: (r.identifier as string).toLowerCase(),
      invitationId: r.invitationId ?? r.invitation_id ?? null,
    }))
    .sort((a, b) => a.identifier.localeCompare(b.identifier));
}

export async function addAllowed(email: string, notify = true): Promise<void> {
  const norm = email.trim().toLowerCase();
  if (!norm.includes("@")) throw new Error("Invalid email");
  const client = await clerkClient();
  await client.allowlistIdentifiers.createAllowlistIdentifier({
    identifier: norm,
    notify, // sends a Clerk-branded sign-up invite when true
  });
}

export async function removeAllowed(id: string): Promise<void> {
  if (!id) throw new Error("Missing id");
  const client = await clerkClient();
  await client.allowlistIdentifiers.deleteAllowlistIdentifier(id);
}

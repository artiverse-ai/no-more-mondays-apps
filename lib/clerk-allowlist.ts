// Read/write the Clerk allowlist — the source of truth for who can sign in.
//
// Each allow-listed email has one of three states:
//   accepted  — they signed up; a Clerk user exists for this email
//   pending   — they've been invited but haven't created an account yet
//   allowed   — on the allowlist with no outstanding invitation (rare —
//               happens if the invitation expired or was created with
//               notify: false)

import { clerkClient } from "@clerk/nextjs/server";

export type AllowedStatus = "accepted" | "pending" | "allowed";

export type Allowed = {
  id: string;
  identifier: string; // email
  status: AllowedStatus;
  invitationId?: string | null;
};

type AllowlistRow = {
  id: string;
  identifier?: string;
  invitation_id?: string | null;
  invitationId?: string | null;
};

type InvitationRow = {
  id: string;
  email_address?: string;
  emailAddress?: string;
  status?: string;
};

type UserRow = {
  emailAddresses?: Array<{ emailAddress?: string }>;
  email_addresses?: Array<{ email_address?: string }>;
};

function unwrap<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  if (res && typeof res === "object" && "data" in res) {
    return ((res as { data: T[] }).data ?? []) as T[];
  }
  return [];
}

export async function getAllowed(): Promise<Allowed[]> {
  const client = await clerkClient();

  // Fetch allowlist, pending invitations, and existing users in parallel.
  // The user list is bounded — for our team size (<100) we ask for 200 to
  // be safe.
  const [allowlistRes, invitationsRes, usersRes] = await Promise.all([
    client.allowlistIdentifiers.getAllowlistIdentifierList(),
    client.invitations.getInvitationList({ status: "pending" }),
    client.users.getUserList({ limit: 200 }),
  ]);

  const allowlist = unwrap<AllowlistRow>(allowlistRes).filter((r) => r.identifier);
  const invitations = unwrap<InvitationRow>(invitationsRes);
  const users = unwrap<UserRow>(usersRes);

  // Set of emails for which a Clerk user already exists.
  const userEmails = new Set<string>(
    users
      .flatMap((u) => {
        const emails: string[] = [];
        for (const e of u.emailAddresses ?? []) {
          if (e.emailAddress) emails.push(e.emailAddress.toLowerCase());
        }
        for (const e of u.email_addresses ?? []) {
          if (e.email_address) emails.push(e.email_address.toLowerCase());
        }
        return emails;
      })
      .filter(Boolean),
  );

  // Set of emails with an outstanding (pending) invitation.
  const pendingEmails = new Set<string>(
    invitations
      .map((i) =>
        (i.emailAddress ?? i.email_address ?? "").toLowerCase(),
      )
      .filter(Boolean),
  );

  return allowlist
    .map((r) => {
      const email = (r.identifier as string).toLowerCase();
      const status: AllowedStatus = userEmails.has(email)
        ? "accepted"
        : pendingEmails.has(email)
          ? "pending"
          : "allowed";
      return {
        id: r.id,
        identifier: email,
        status,
        invitationId: r.invitationId ?? r.invitation_id ?? null,
      };
    })
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

// Read/write the Clerk allowlist — the source of truth for who can sign in.
//
// Each allow-listed email has one of three states:
//   accepted  — they signed up; a Clerk user exists for this email
//   pending   — they've been invited but haven't created an account yet
//   allowed   — on the allowlist with no outstanding invitation (rare —
//               happens if the invitation expired or was created with
//               notify: false)
//
// Each allow-listed user also has a `role`:
//   user      — default; can sign in but not access /admin
//   admin     — can access /admin and manage closers + site access
//
// Bootstrap admins (ADMIN_EMAILS env var) are always admin regardless of
// the role stored here.

import { clerkClient } from "@clerk/nextjs/server";

export type AllowedStatus = "accepted" | "pending" | "allowed";
export type Role = "user" | "admin";

export type Allowed = {
  id: string;
  identifier: string; // email
  status: AllowedStatus;
  role: Role;
  isBootstrapAdmin: boolean; // true → admin via ADMIN_EMAILS, role can't be demoted
  clerkUserId?: string | null; // present when status === "accepted"
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
  public_metadata?: Record<string, unknown> | null;
  publicMetadata?: Record<string, unknown> | null;
};

type UserRow = {
  id: string;
  emailAddresses?: Array<{ emailAddress?: string }>;
  email_addresses?: Array<{ email_address?: string }>;
  publicMetadata?: Record<string, unknown> | null;
  public_metadata?: Record<string, unknown> | null;
};

function unwrap<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  if (res && typeof res === "object" && "data" in res) {
    return ((res as { data: T[] }).data ?? []) as T[];
  }
  return [];
}

function bootstrapAdminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

function roleFromMetadata(meta: Record<string, unknown> | null | undefined): Role {
  const r = meta?.role;
  return r === "admin" ? "admin" : "user";
}

export async function getAllowed(): Promise<Allowed[]> {
  const client = await clerkClient();
  const bootstrap = bootstrapAdminEmails();

  const [allowlistRes, invitationsRes, usersRes] = await Promise.all([
    client.allowlistIdentifiers.getAllowlistIdentifierList(),
    client.invitations.getInvitationList({ status: "pending" }),
    client.users.getUserList({ limit: 200 }),
  ]);

  const allowlist = unwrap<AllowlistRow>(allowlistRes).filter((r) => r.identifier);
  const invitations = unwrap<InvitationRow>(invitationsRes);
  const users = unwrap<UserRow>(usersRes);

  // email → user (the first user matched for the email)
  const userByEmail = new Map<string, UserRow>();
  for (const u of users) {
    const emails: string[] = [];
    for (const e of u.emailAddresses ?? []) {
      if (e.emailAddress) emails.push(e.emailAddress.toLowerCase());
    }
    for (const e of u.email_addresses ?? []) {
      if (e.email_address) emails.push(e.email_address.toLowerCase());
    }
    for (const em of emails) {
      if (!userByEmail.has(em)) userByEmail.set(em, u);
    }
  }

  // email → pending invitation
  const inviteByEmail = new Map<string, InvitationRow>();
  for (const inv of invitations) {
    const em = (inv.emailAddress ?? inv.email_address ?? "").toLowerCase();
    if (em) inviteByEmail.set(em, inv);
  }

  return allowlist
    .map((r) => {
      const email = (r.identifier as string).toLowerCase();
      const user = userByEmail.get(email);
      const invite = inviteByEmail.get(email);
      const status: AllowedStatus = user
        ? "accepted"
        : invite
          ? "pending"
          : "allowed";
      const meta = user
        ? (user.publicMetadata ?? user.public_metadata)
        : (invite?.publicMetadata ?? invite?.public_metadata);
      const role: Role = roleFromMetadata(meta);
      const isBootstrapAdmin = bootstrap.has(email);
      return {
        id: r.id,
        identifier: email,
        status,
        role: isBootstrapAdmin ? "admin" : role,
        isBootstrapAdmin,
        clerkUserId: user?.id ?? null,
        invitationId: r.invitationId ?? r.invitation_id ?? null,
      };
    })
    .sort((a, b) => a.identifier.localeCompare(b.identifier));
}

export async function addAllowed(
  email: string,
  opts: { notify?: boolean; role?: Role } = {},
): Promise<void> {
  const { notify = true, role = "user" } = opts;
  const norm = email.trim().toLowerCase();
  if (!norm.includes("@")) throw new Error("Invalid email");
  const client = await clerkClient();
  await client.allowlistIdentifiers.createAllowlistIdentifier({
    identifier: norm,
    notify,
  });
  // Stamp the desired role onto a fresh invitation so when the user signs
  // up, their Clerk publicMetadata carries it. (createAllowlistIdentifier
  // also creates an invitation when notify=true, but doesn't accept
  // publicMetadata — so create our own invitation with the role baked in.)
  if (notify && role === "admin") {
    try {
      await client.invitations.createInvitation({
        emailAddress: norm,
        publicMetadata: { role: "admin" },
        ignoreExisting: true,
      });
    } catch {
      // Already-pending invitation is fine; the role will be set on the
      // user post-signup via setRoleForExistingUser below.
    }
  }
}

export async function removeAllowed(id: string): Promise<void> {
  if (!id) throw new Error("Missing id");
  const client = await clerkClient();
  await client.allowlistIdentifiers.deleteAllowlistIdentifier(id);
}

// Set a role on the user (or pending invitation) for an email.
export async function setRole(email: string, role: Role): Promise<void> {
  const norm = email.trim().toLowerCase();
  const client = await clerkClient();

  // Update existing Clerk user if there is one.
  const usersRes = await client.users.getUserList({
    emailAddress: [norm],
    limit: 5,
  });
  const users = unwrap<UserRow>(usersRes);
  if (users.length > 0) {
    const u = users[0];
    await client.users.updateUser(u.id, {
      publicMetadata: { ...(u.publicMetadata ?? u.public_metadata ?? {}), role },
    });
    return;
  }

  // Otherwise update the pending invitation by re-issuing it with new
  // metadata (Clerk doesn't expose an in-place metadata edit on invitations
  // in v2; revoke + create is the supported path).
  const invRes = await client.invitations.getInvitationList({
    status: "pending",
  });
  const pending = unwrap<InvitationRow>(invRes).find(
    (i) => (i.emailAddress ?? i.email_address)?.toLowerCase() === norm,
  );
  if (pending) {
    try {
      await client.invitations.revokeInvitation(pending.id);
    } catch {
      /* race — already accepted or revoked, fine */
    }
  }
  await client.invitations.createInvitation({
    emailAddress: norm,
    publicMetadata: { role },
    ignoreExisting: true,
  });
}

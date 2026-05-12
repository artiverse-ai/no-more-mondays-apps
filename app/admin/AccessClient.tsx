"use client";

import { useState, useTransition } from "react";
import {
  addAllowedAction,
  removeAllowedAction,
  setRoleAction,
} from "./actions";

type AllowedStatus = "accepted" | "pending" | "allowed";
type Role = "user" | "admin";

type Allowed = {
  id: string;
  identifier: string;
  status: AllowedStatus;
  role: Role;
  isBootstrapAdmin: boolean;
  invitationId?: string | null;
};

const STATUS_STYLE: Record<AllowedStatus, { label: string; cls: string }> = {
  accepted: {
    label: "Active",
    cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700",
  },
  pending: {
    label: "Pending invite",
    cls: "border-amber-500/40 bg-amber-500/10 text-amber-800",
  },
  allowed: {
    label: "Allowlisted",
    cls: "border-border bg-muted text-muted-foreground",
  },
};

type Props = {
  initial: Allowed[];
  adminEmail: string;
};

export function AccessClient({ initial, adminEmail }: Props) {
  const [allowed, setAllowed] = useState<Allowed[]>(initial);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<Role>("user");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setError(null);
    setNotice(null);
  };

  const onAdd = (e: React.FormEvent) => {
    e.preventDefault();
    reset();
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed) return;
    if (!trimmed.includes("@") || trimmed.indexOf(".") < trimmed.indexOf("@")) {
      setError("Enter a valid email.");
      return;
    }
    if (allowed.some((a) => a.identifier === trimmed)) {
      setError("Already on the allow-list.");
      return;
    }
    startTransition(async () => {
      try {
        const created = await addAllowedAction(trimmed, newRole);
        setAllowed((cur) =>
          [...cur, created].sort((a, b) =>
            a.identifier.localeCompare(b.identifier),
          ),
        );
        setNewEmail("");
        setNewRole("user");
        setNotice(
          `Invited ${trimmed} as ${newRole === "admin" ? "admin" : "user"} — Clerk emailed them a sign-up link.`,
        );
      } catch (e) {
        setError((e as Error).message);
      }
    });
  };

  const onRemove = (entry: Allowed) => {
    reset();
    if (entry.isBootstrapAdmin) {
      setError(
        "This is a bootstrap admin (set via ADMIN_EMAILS env var). Remove them there, not here.",
      );
      return;
    }
    const isSelf = entry.identifier === adminEmail.toLowerCase();
    const msg = isSelf
      ? "Remove yourself? You'll lose admin access next sign-in."
      : `Revoke access for ${entry.identifier}?`;
    if (!confirm(msg)) return;
    startTransition(async () => {
      try {
        await removeAllowedAction(entry.id);
        setAllowed((cur) => cur.filter((a) => a.id !== entry.id));
        setNotice(`Removed ${entry.identifier}.`);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  };

  const onToggleRole = (entry: Allowed) => {
    reset();
    if (entry.isBootstrapAdmin) {
      setError(
        "This is a bootstrap admin (set via ADMIN_EMAILS env var). Role can't be changed here.",
      );
      return;
    }
    const nextRole: Role = entry.role === "admin" ? "user" : "admin";
    const isSelf = entry.identifier === adminEmail.toLowerCase();
    if (isSelf && nextRole === "user") {
      if (
        !confirm("Demote yourself to user? You'll lose admin access next sign-in.")
      ) {
        return;
      }
    }
    // Optimistic update.
    setAllowed((cur) =>
      cur.map((a) => (a.id === entry.id ? { ...a, role: nextRole } : a)),
    );
    startTransition(async () => {
      try {
        await setRoleAction(entry.identifier, nextRole);
        setNotice(
          `${entry.identifier} → ${nextRole === "admin" ? "admin" : "user"}.`,
        );
      } catch (e) {
        // Revert on failure.
        setAllowed((cur) =>
          cur.map((a) =>
            a.id === entry.id ? { ...a, role: entry.role } : a,
          ),
        );
        setError((e as Error).message);
      }
    });
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={onAdd}
        className="rounded-2xl border border-border bg-card p-5 shadow-sm"
      >
        <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Invite by email
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="someone@example.com"
            disabled={pending}
            className="flex-1 min-w-[200px] rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60"
          />
          <div
            role="radiogroup"
            aria-label="Role"
            className="inline-flex rounded-lg border border-border bg-background p-0.5"
          >
            <RoleBtn
              active={newRole === "user"}
              onClick={() => setNewRole("user")}
              disabled={pending}
            >
              User
            </RoleBtn>
            <RoleBtn
              active={newRole === "admin"}
              onClick={() => setNewRole("admin")}
              disabled={pending}
            >
              Admin
            </RoleBtn>
          </div>
          <button
            type="submit"
            disabled={pending || !newEmail.trim()}
            className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Working…" : "Invite"}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Adds the email to Clerk&rsquo;s allowlist and emails a sign-up link.
          Once they click it and create an account they can sign in. Admins
          can additionally manage the closer roster + this allow-list.
        </p>
      </form>

      {notice ? (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2.5">
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Allowed users
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            {allowed.length}
          </span>
        </div>
        {allowed.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            Nobody on the list yet. Invite the first user above.
          </p>
        ) : (
          <ul>
            {allowed.map((entry) => {
              const isSelf = entry.identifier === adminEmail.toLowerCase();
              return (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-2.5 last:border-b-0"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm">{entry.identifier}</span>
                    {isSelf ? (
                      <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                        you
                      </span>
                    ) : null}
                    <span
                      className={
                        "rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] " +
                        STATUS_STYLE[entry.status].cls
                      }
                    >
                      {STATUS_STYLE[entry.status].label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onToggleRole(entry)}
                      disabled={pending || entry.isBootstrapAdmin}
                      title={
                        entry.isBootstrapAdmin
                          ? "Bootstrap admin (ADMIN_EMAILS env var) — can't be changed here"
                          : `Click to ${entry.role === "admin" ? "demote to user" : "promote to admin"}`
                      }
                      className={
                        "rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.08em] transition disabled:cursor-not-allowed disabled:opacity-60 " +
                        (entry.role === "admin"
                          ? "border-accent/50 bg-accent/10 text-accent hover:bg-accent/15"
                          : "border-border bg-background text-muted-foreground hover:text-foreground")
                      }
                    >
                      {entry.role === "admin" ? "Admin" : "User"}
                      {entry.isBootstrapAdmin ? " ★" : ""}
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemove(entry)}
                      disabled={pending || entry.isBootstrapAdmin}
                      className="rounded-md border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground hover:border-destructive hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50"
                      title={
                        entry.isBootstrapAdmin
                          ? "Bootstrap admin — remove via ADMIN_EMAILS env var instead"
                          : "Revoke access"
                      }
                    >
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        <strong>Roles:</strong> <em>User</em> can sign in and use the apps.
        <em> Admin</em> can additionally manage the closer roster + this list.
        Admin role is stored on the Clerk user&rsquo;s
        <code className="mx-1 rounded bg-muted px-1 py-0.5 text-[10px]">
          publicMetadata.role
        </code>
        and takes effect on next sign-in. Entries marked with ★ are
        bootstrap admins set via the <code>ADMIN_EMAILS</code> env var; their
        role can&rsquo;t be changed from this page.
      </p>
    </div>
  );
}

function RoleBtn({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      disabled={disabled}
      className={
        "rounded-md px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 " +
        (active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}

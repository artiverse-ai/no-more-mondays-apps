"use client";

import { useState, useTransition } from "react";
import { addAllowedAction, removeAllowedAction } from "./actions";

type AllowedStatus = "accepted" | "pending" | "allowed";

type Allowed = {
  id: string;
  identifier: string;
  status: AllowedStatus;
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
        const created = await addAllowedAction(trimmed);
        setAllowed((cur) =>
          [...cur, created].sort((a, b) =>
            a.identifier.localeCompare(b.identifier),
          ),
        );
        setNewEmail("");
        setNotice(`Added ${trimmed} — Clerk emailed them a sign-up link.`);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  };

  const onRemove = (entry: Allowed) => {
    reset();
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

  return (
    <div className="space-y-6">
      <form
        onSubmit={onAdd}
        className="rounded-2xl border border-border bg-card p-5 shadow-sm"
      >
        <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Invite by email
        </label>
        <div className="flex gap-2">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="someone@example.com"
            disabled={pending}
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={pending || !newEmail.trim()}
            className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Working…" : "Invite"}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Adds the email to Clerk&rsquo;s allowlist and emails them a sign-up
          link. Once they click it and create a Clerk account they can sign
          in. Removing here revokes their access on the next sign-in.
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
                  className="flex items-center justify-between border-b border-border/60 px-4 py-2.5 last:border-b-0"
                >
                  <div className="flex items-center gap-2">
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
                  <button
                    type="button"
                    onClick={() => onRemove(entry)}
                    disabled={pending}
                    className="rounded-md border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground hover:border-destructive hover:text-destructive disabled:opacity-50"
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

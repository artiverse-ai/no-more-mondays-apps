"use client";

import { useState, useTransition } from "react";
import { addUserAction, removeUserAction } from "./actions";

type Props = {
  initialEmails: string[];
  adminEmail: string;
};

export function AdminClient({ initialEmails, adminEmail }: Props) {
  const [emails, setEmails] = useState<string[]>(initialEmails);
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
    if (emails.includes(trimmed)) {
      setError("Already on the list.");
      return;
    }
    startTransition(async () => {
      try {
        await addUserAction(trimmed);
        setEmails([...emails, trimmed].sort());
        setNewEmail("");
        setNotice(`Added ${trimmed}.`);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  };

  const onRemove = (email: string) => {
    reset();
    const isSelf = email === adminEmail;
    const msg = isSelf
      ? "Remove yourself? You'll lose access next sign-in."
      : `Remove ${email}?`;
    if (!confirm(msg)) return;
    startTransition(async () => {
      try {
        await removeUserAction(email);
        setEmails(emails.filter((e) => e !== email));
        setNotice(`Removed ${email}.`);
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
          Add user by email
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
            {pending ? "Working…" : "Add"}
          </button>
        </div>
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
            {emails.length}
          </span>
        </div>
        {emails.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            No users yet. Add the first email above.
          </p>
        ) : (
          <ul>
            {emails.map((email) => {
              const isSelf = email === adminEmail;
              return (
                <li
                  key={email}
                  className="flex items-center justify-between border-b border-border/60 px-4 py-2.5 last:border-b-0"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">{email}</span>
                    {isSelf ? (
                      <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                        you
                      </span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemove(email)}
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

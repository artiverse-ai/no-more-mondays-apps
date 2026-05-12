"use client";

import { useState, useTransition } from "react";
import {
  addCloserAction,
  removeCloserAction,
  setCloserFlagAction,
} from "./actions";
import type { Closer, CloserFlag } from "@/lib/closers";

type Props = {
  initial: Closer[];
};

const shortName = (email: string) => email.split("@")[0];

export function ClosersClient({ initial }: Props) {
  const [closers, setClosers] = useState<Closer[]>(initial);
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
    if (closers.some((c) => c.email === trimmed)) {
      setError("Already on the list.");
      return;
    }
    startTransition(async () => {
      try {
        await addCloserAction(trimmed);
        setClosers(
          [
            ...closers,
            { email: trimmed, is_active: true, is_available_to_take_call: true },
          ].sort((a, b) => a.email.localeCompare(b.email)),
        );
        setNewEmail("");
        setNotice(`Added ${trimmed}.`);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  };

  const onToggle = (email: string, field: CloserFlag, current: boolean) => {
    reset();
    const next = !current;
    // Optimistic update.
    setClosers((cs) =>
      cs.map((c) => (c.email === email ? { ...c, [field]: next } : c)),
    );
    startTransition(async () => {
      try {
        await setCloserFlagAction(email, field, next);
      } catch (e) {
        // Revert on failure.
        setClosers((cs) =>
          cs.map((c) => (c.email === email ? { ...c, [field]: current } : c)),
        );
        setError((e as Error).message);
      }
    });
  };

  const onRemove = (email: string) => {
    reset();
    if (!confirm(`Remove ${email} from the closer roster?`)) return;
    startTransition(async () => {
      try {
        await removeCloserAction(email);
        setClosers((cs) => cs.filter((c) => c.email !== email));
        setNotice(`Removed ${email}.`);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  };

  const activeAvailable = closers.filter(
    (c) => c.is_active && c.is_available_to_take_call,
  ).length;
  const inactive = closers.filter((c) => !c.is_active).length;
  const paused = closers.filter(
    (c) => c.is_active && !c.is_available_to_take_call,
  ).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="In dashboard" value={activeAvailable} accent />
        <Stat
          label="Paused"
          value={paused}
          sub="active but unavailable"
        />
        <Stat label="Off-roster" value={inactive} sub="inactive" />
      </div>

      <form
        onSubmit={onAdd}
        className="rounded-2xl border border-border bg-card p-5 shadow-sm"
      >
        <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Add closer by email
        </label>
        <div className="flex gap-2">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="closer@nomoremondays.io"
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
        <p className="mt-2 text-[11px] text-muted-foreground">
          New closers join with both flags <strong>on</strong>. Make sure their
          calendar is shared with <code>ops@nomoremondays.io</code> (see{" "}
          <a
            className="text-accent underline"
            href="/sops/new-closer-joins"
          >
            new closer joins SOP
          </a>
          ) before flipping them on.
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
            Roster
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            {closers.length}
          </span>
        </div>
        {closers.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            No closers yet. Add the first email above.
          </p>
        ) : (
          <ul>
            {closers.map((closer) => (
              <li
                key={closer.email}
                className="grid grid-cols-1 gap-3 border-b border-border/60 px-4 py-3 last:border-b-0 md:grid-cols-[1fr_auto_auto_auto] md:items-center"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {shortName(closer.email)}
                  </div>
                  <div className="truncate font-mono text-[11px] text-muted-foreground">
                    {closer.email}
                  </div>
                </div>
                <Toggle
                  label="Active"
                  on={closer.is_active}
                  disabled={pending}
                  onToggle={() =>
                    onToggle(closer.email, "is_active", closer.is_active)
                  }
                />
                <Toggle
                  label="Available"
                  on={closer.is_available_to_take_call}
                  disabled={pending || !closer.is_active}
                  onToggle={() =>
                    onToggle(
                      closer.email,
                      "is_available_to_take_call",
                      closer.is_available_to_take_call,
                    )
                  }
                />
                <button
                  type="button"
                  onClick={() => onRemove(closer.email)}
                  disabled={pending}
                  className="justify-self-end rounded-md border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground hover:border-destructive hover:text-destructive disabled:opacity-50"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        <strong>How the dashboard reads this:</strong> only closers with both{" "}
        <em>Active</em> AND <em>Available</em> on appear in the booking
        capacity dashboard. Flip <em>Available</em> off to temporarily pause
        someone (e.g., vacation) without removing them. Flip <em>Active</em>{" "}
        off to take them off-roster entirely while preserving history. Changes
        propagate within 5 minutes via the calendar sync.
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p
        className={
          "mt-2 font-heading text-3xl font-semibold tabular-nums " +
          (accent ? "text-accent" : "text-foreground")
        }
      >
        {value}
      </p>
      {sub ? (
        <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>
      ) : null}
    </div>
  );
}

function Toggle({
  label,
  on,
  disabled,
  onToggle,
}: {
  label: string;
  on: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={
        "flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 " +
        (on
          ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700"
          : "border-border bg-background text-muted-foreground hover:border-foreground/40 hover:text-foreground")
      }
      aria-pressed={on}
    >
      <span
        aria-hidden
        className={
          "inline-block h-2 w-2 rounded-full " +
          (on ? "bg-emerald-500" : "bg-muted-foreground/40")
        }
      />
      {label}
    </button>
  );
}

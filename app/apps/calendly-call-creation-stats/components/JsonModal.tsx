"use client";

import { useEffect } from "react";
import { SearchResult } from "../lib/types";

type Data = NonNullable<ReturnType<SearchResult["rawById"]["get"]>>;

export function JsonModal({ data, onClose }: { data: Data; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const memberships = data.event.event_memberships || [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-[900px] flex-col overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border bg-muted/40 px-5 py-3">
          <span className="text-sm font-semibold">
            Raw API Response · {data.invitee.name || "—"}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border bg-background px-3 py-1 text-xs hover:border-accent/40"
          >
            ✕ Close
          </button>
        </div>
        <div className="flex-1 overflow-auto p-5">
          <Section title="event type">
            <div className="space-y-1 rounded-md border border-border bg-background p-3 font-mono text-[11px] leading-relaxed text-foreground/80">
              <div>
                <span className="text-muted-foreground">Name:</span>{" "}
                {data.eventType.name || "—"}
              </div>
              <div>
                <span className="text-muted-foreground">Internal note:</span>{" "}
                {data.eventType.internal_note || "—"}
              </div>
              <div className="pt-2">
                <span className="text-muted-foreground">Hosts (event_memberships):</span>
              </div>
              {memberships.length === 0 ? (
                <div className="pl-3 text-rose-700">(empty)</div>
              ) : (
                memberships.map((m, i) => (
                  <div key={i} className="pl-3">
                    {m.user_name || "?"}{" "}
                    <span className="text-muted-foreground">&lt;{m.user_email || ""}&gt;</span>
                  </div>
                ))
              )}
            </div>
          </Section>

          <Section title="scheduled_event">
            <Pre>{JSON.stringify(data.event, null, 2)}</Pre>
          </Section>
          <Section title="invitee">
            <Pre>{JSON.stringify(data.invitee, null, 2)}</Pre>
          </Section>
          <Section title="event_type">
            <Pre>{JSON.stringify(data.eventType, null, 2)}</Pre>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5 last:mb-0">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.07em] text-accent">{title}</p>
      {children}
    </div>
  );
}

function Pre({ children }: { children: string }) {
  return (
    <pre className="overflow-auto rounded-md border border-border bg-background p-3 font-mono text-[11px] leading-relaxed text-foreground/80">
      {children}
    </pre>
  );
}

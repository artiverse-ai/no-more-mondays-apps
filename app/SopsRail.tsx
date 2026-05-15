"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export type SopRailEntry = {
  href: string;
  title: string;
  description: string;
  external?: boolean;
};

const STORAGE_KEY = "sops-rail-open";

export function SopsRail({ sops }: { sops: SopRailEntry[] }) {
  // Default expanded. After mount, restore user's last preference (if any) so
  // the rail doesn't flash open then collapse — we set it via classList rather
  // than state to avoid hydration mismatch.
  const [open, setOpen] = useState(true);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "0") setOpen(false);
      else if (stored === "1") setOpen(true);
    } catch {
      /* localStorage unavailable — keep default expanded */
    }
  }, []);

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return (
    <aside
      className={
        "w-full shrink-0 transition-[width] duration-200 ease-out lg:py-6 lg:pr-6 " +
        (open ? "lg:w-80" : "lg:w-16")
      }
      aria-label="SOPs"
    >
      <div className="flex flex-col rounded-2xl border border-border bg-card shadow-sm lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)]">
        {/* Header bar — different layout when collapsed (vertical) vs expanded */}
        {open ? (
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
            <h2 className="font-heading text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              SOPs
            </h2>
            <button
              type="button"
              onClick={toggle}
              aria-label="Collapse SOPs"
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <span aria-hidden>→</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={toggle}
            aria-label="Expand SOPs"
            className="flex w-full flex-col items-center gap-3 py-3 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <span aria-hidden className="text-xs">
              ←
            </span>
            <span
              className="font-heading text-[11px] font-medium uppercase tracking-[0.18em]"
              style={{
                writingMode: "vertical-rl",
                transform: "rotate(180deg)",
              }}
            >
              SOPs
            </span>
          </button>
        )}

        {open ? (
          <ul className="space-y-1 overflow-y-auto p-2">
            {sops.map((sop) => (
              <li key={sop.href}>
                <SopRailItem sop={sop} />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </aside>
  );
}

function SopRailItem({ sop }: { sop: SopRailEntry }) {
  const isExternal = sop.external === true;
  const body = (
    <div className="block rounded-lg px-3 py-2.5 transition-colors hover:bg-secondary">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium leading-snug">{sop.title}</span>
        <span
          className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-muted-foreground opacity-0 transition-opacity group-hover/sop:opacity-100"
          aria-hidden
        >
          {isExternal ? "↗" : "→"}
        </span>
      </div>
      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
        {sop.description}
      </p>
    </div>
  );
  if (isExternal) {
    return (
      <a
        href={sop.href}
        target="_blank"
        rel="noopener noreferrer"
        className="group/sop block"
      >
        {body}
      </a>
    );
  }
  return (
    <Link href={sop.href} className="group/sop block">
      {body}
    </Link>
  );
}

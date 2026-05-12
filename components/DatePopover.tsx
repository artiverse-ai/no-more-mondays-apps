"use client";

import { useEffect, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";

// Date input with a custom popover calendar that ALWAYS starts the week on
// Monday, regardless of the visitor's OS locale (the browser's native
// `<input type="date">` picker uses the OS week-start setting and we can't
// override it).

type Props = {
  /** ISO yyyy-mm-dd */
  value: string;
  onChange: (next: string) => void;
  min?: string;
  max?: string;
  /** Renders the trigger — we hand it click handlers; styling stays in the
   *  caller so the dashboard's existing visual treatment is preserved. */
  children: (props: {
    onClick: () => void;
    "aria-haspopup": "dialog";
    "aria-expanded": boolean;
  }) => React.ReactNode;
};

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function fromISO(s: string | undefined): Date | undefined {
  if (!s) return undefined;
  const [y, m, d] = s.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

export function DatePopover({ value, onChange, min, max, children }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative inline-block">
      {children({
        onClick: () => setOpen((v) => !v),
        "aria-haspopup": "dialog",
        "aria-expanded": open,
      })}
      {open ? (
        <div
          role="dialog"
          aria-label="Pick date"
          className="absolute left-0 top-full z-30 mt-2 rounded-xl border border-border bg-card p-3 shadow-lg"
        >
          <DayPicker
            mode="single"
            weekStartsOn={1}
            selected={fromISO(value)}
            onSelect={(d) => {
              if (!d) return;
              onChange(toISO(d));
              setOpen(false);
            }}
            disabled={[
              ...(min ? [{ before: fromISO(min)! }] : []),
              ...(max ? [{ after: fromISO(max)! }] : []),
            ]}
            showOutsideDays
            classNames={{
              root: "rdp-root",
              months: "flex flex-col gap-3",
              month: "space-y-3",
              caption_label: "font-heading text-sm font-semibold",
              nav: "flex gap-1",
              button_previous:
                "h-7 w-7 rounded-md border border-border bg-background text-foreground hover:bg-secondary inline-flex items-center justify-center",
              button_next:
                "h-7 w-7 rounded-md border border-border bg-background text-foreground hover:bg-secondary inline-flex items-center justify-center",
              month_grid: "w-full border-collapse",
              weekday: "text-[10px] font-medium uppercase tracking-wider text-muted-foreground p-1",
              day: "p-0.5",
              day_button:
                "h-8 w-8 rounded-md text-sm font-medium hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-accent/40",
              today: "font-bold text-accent",
              selected:
                "[&_button]:bg-foreground [&_button]:text-background [&_button]:hover:bg-foreground/90",
              outside: "[&_button]:text-muted-foreground/40",
              disabled: "[&_button]:opacity-40 [&_button]:pointer-events-none",
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDownIcon, CheckIcon, SearchIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  loading?: boolean;
  emptyMessage?: string;
  searchPlaceholder?: string;
  /** Pixel width of the trigger button. Defaults to `w-full`. */
  className?: string;
};

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Select…",
  loading = false,
  emptyMessage = "No options available",
  searchPlaceholder = "Search…",
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (!open) return;
    // Focus the search input next tick so the popover has rendered. We don't
    // reset `query` on close — the user often wants their last filter back
    // when they reopen.
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

  const selectedSet = useMemo(() => new Set(value), [value]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, query]);

  const allSelected = options.length > 0 && value.length === options.length;
  const someSelected = value.length > 0 && !allSelected;

  const toggle = (option: string) => {
    if (selectedSet.has(option)) {
      onChange(value.filter((v) => v !== option));
    } else {
      onChange([...value, option]);
    }
  };

  const selectAll = () => onChange([...options]);
  const clear = () => onChange([]);

  const summary = loading
    ? "Loading options…"
    : options.length === 0
    ? emptyMessage
    : value.length === 0
    ? placeholder
    : allSelected
    ? `All ${options.length} selected`
    : value.length === 1
    ? value[0]
    : `${value.length} selected`;

  return (
    <div ref={wrapRef} className={cn("relative", className ?? "w-full")}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={loading || options.length === 0}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-60",
          value.length === 0 ? "text-muted-foreground" : "text-foreground",
        )}
      >
        <span className="truncate">{summary}</span>
        <ChevronDownIcon
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition",
            open && "rotate-180",
          )}
        />
      </button>
      {open ? (
        <div
          role="listbox"
          aria-multiselectable
          className="absolute left-0 right-0 top-full z-30 mt-2 max-h-80 overflow-hidden rounded-xl border border-border bg-card shadow-lg"
        >
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <SearchIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-1.5">
            <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {filtered.length} of {options.length}
              {someSelected || allSelected
                ? ` · ${value.length} picked`
                : ""}
            </span>
            <div className="flex items-center gap-2 text-[11px] font-medium">
              <button
                type="button"
                onClick={selectAll}
                disabled={allSelected}
                className="text-accent transition hover:underline disabled:cursor-not-allowed disabled:opacity-50"
              >
                Select all
              </button>
              <span className="text-border">|</span>
              <button
                type="button"
                onClick={clear}
                disabled={value.length === 0}
                className="text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                Clear
              </button>
            </div>
          </div>
          <ul className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-xs text-muted-foreground">
                No matches
              </li>
            ) : (
              filtered.map((option) => {
                const checked = selectedSet.has(option);
                return (
                  <li key={option}>
                    <button
                      type="button"
                      onClick={() => toggle(option)}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition hover:bg-muted/60"
                    >
                      <span
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition",
                          checked
                            ? "border-accent bg-accent text-background"
                            : "border-border bg-background",
                        )}
                      >
                        {checked ? <CheckIcon className="h-3 w-3" /> : null}
                      </span>
                      <span className="truncate">{option}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

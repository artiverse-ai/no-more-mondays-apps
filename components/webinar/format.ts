// Presentational helpers for the Webinar Performance dashboard. Pure functions
// — safe to import from both server and client components.

type Maybe = number | null | undefined;

export const fmt = {
  int: (n: Maybe) => (n == null ? "—" : Number(n).toLocaleString("en-US")),
  money: (n: Maybe) =>
    n == null
      ? "—"
      : "$" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 }),
  money2: (n: Maybe) =>
    n == null
      ? "—"
      : "$" +
        Number(n).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
  /** Compact dollars for chart axes: $1.2M / $48k / $320. */
  compactMoney: (n: Maybe) => {
    if (n == null) return "—";
    const v = Number(n);
    const a = Math.abs(v);
    if (a >= 1_000_000) return "$" + (v / 1_000_000).toFixed(1) + "M";
    if (a >= 1_000) return "$" + Math.round(v / 1_000) + "k";
    return "$" + Math.round(v);
  },
  pct: (n: Maybe) => (n == null ? "—" : (Number(n) * 100).toFixed(1) + "%"),
  ratio: (n: Maybe) => (n == null ? "—" : Number(n).toFixed(2) + "x"),
  /** "May 6, 2026" from a YYYY-MM-DD string (rendered in UTC for stability). */
  date: (s: string | null | undefined) => {
    if (!s) return "—";
    return new Date(s + "T00:00:00Z").toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  },
  /** "May 6" from a YYYY-MM-DD string. */
  dateShort: (s: string | null | undefined) => {
    if (!s) return "";
    return new Date(s + "T00:00:00Z").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  },
  /** "May 14, 2026, 8:30 PM" from an ISO timestamp. */
  dt: (s: string | null | undefined) => {
    if (!s) return "—";
    const d = new Date(s);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  },
};

export function eraLabel(era: string): string {
  if (era === "core_new_ads") return "new ads";
  if (era === "core_old_ads") return "old ads";
  return "legacy";
}

// Tailwind class fragments for the day / era badges (used with <Badge variant="outline">).
export function dayBadgeClass(day: string): string {
  switch (day) {
    case "Sunday":
      return "border-amber-300 bg-amber-50 text-amber-800";
    case "Wednesday":
      return "border-sky-300 bg-sky-50 text-sky-800";
    case "Monthly Workshop":
      return "border-pink-300 bg-pink-50 text-pink-800";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

export function eraBadgeClass(era: string): string {
  if (era === "core_new_ads")
    return "border-emerald-300 bg-emerald-50 text-emerald-800";
  return "border-border bg-muted text-muted-foreground";
}

// Shared Recharts styling so every chart matches the app theme.
export const TOOLTIP_CONTENT_STYLE = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--foreground)",
};
export const TOOLTIP_LABEL_STYLE = {
  color: "var(--muted-foreground)",
  marginBottom: 4,
};
export const AXIS_TICK = { fill: "var(--muted-foreground)", fontSize: 11 };
export const AXIS_LINE = { stroke: "var(--border)" };

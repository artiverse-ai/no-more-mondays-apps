"use client";

import { useEffect, useState } from "react";

/** Shows "12 min ago" / "2 days ago" — updates every 30s for live feel.
 *  Fallback while hydrating shows the raw date so SSR + first paint match. */
export function RelativeTime({ dateIso, fallback }: { dateIso: string; fallback: string }) {
  const [text, setText] = useState(fallback);

  useEffect(() => {
    const update = () => setText(formatRelative(dateIso));
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, [dateIso]);

  return <>{text}</>;
}

function formatRelative(dateIso: string): string {
  // dateIso is YYYY-MM-DD (no time). Treat as 12:00 UTC of that day
  // so "today" / "yesterday" classification is robust across timezones.
  const target = new Date(dateIso + "T12:00:00Z");
  const now = new Date();
  const diffMs = now.getTime() - target.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return "a week ago";
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
}

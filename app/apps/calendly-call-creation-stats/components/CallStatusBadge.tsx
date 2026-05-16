"use client";

import { Row } from "../lib/types";

const LABEL: Record<Row["callStatus"], string> = {
  future: "🟢 Future",
  held: "✅ Held",
  no_show: "❌ No-show",
  canceled: "✖ Canceled",
  unknown: "⋯ Awaiting",
};

const STYLE: Record<Row["callStatus"], string> = {
  future: "bg-blue-50 text-blue-700 border-blue-200",
  held: "bg-emerald-50 text-emerald-700 border-emerald-200",
  no_show: "bg-rose-50 text-rose-700 border-rose-200",
  canceled: "bg-zinc-100 text-zinc-600 border-zinc-200",
  unknown: "bg-amber-50 text-amber-700 border-amber-200",
};

export function CallStatusBadge({ status }: { status: Row["callStatus"] }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${STYLE[status]}`}
    >
      {LABEL[status]}
    </span>
  );
}

export const STATUS_OPTIONS: Array<{ key: Row["callStatus"] | "all"; label: string }> = [
  { key: "all", label: "All" },
  { key: "future", label: "🟢 Future" },
  { key: "held", label: "✅ Held" },
  { key: "no_show", label: "❌ No-show" },
  { key: "canceled", label: "✖ Canceled" },
  { key: "unknown", label: "⋯ Awaiting BQ" },
];

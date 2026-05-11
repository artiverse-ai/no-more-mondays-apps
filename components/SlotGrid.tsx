import Link from "next/link";
import type { Slot } from "@/lib/availability";

const shortName = (email: string) => email.split("@")[0];

export function SlotGrid({
  slots,
  totalMembers,
  tz,
  date,
}: {
  slots: Slot[];
  totalMembers: number;
  tz: string;
  date: string;
}) {
  if (slots.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">
        No slots in window. Try widening working hours.
      </div>
    );
  }

  const fmt = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: tz,
  });

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
      {slots.map((s) => (
        <SlotCell
          key={s.slot_start}
          slot={s}
          total={totalMembers}
          label={fmt.format(new Date(s.slot_start))}
          date={date}
          tz={tz}
        />
      ))}
    </div>
  );
}

function SlotCell({
  slot,
  total,
  label,
  date,
  tz,
}: {
  slot: Slot;
  total: number;
  label: string;
  date: string;
  tz: string;
}) {
  const ratio = total > 0 ? slot.available_count / total : 0;
  const tone =
    slot.available_count === 0
      ? "border-destructive/30 bg-destructive/5 hover:border-destructive/50"
      : ratio >= 0.7
      ? "border-accent/40 bg-accent/5 hover:border-accent"
      : ratio >= 0.4
      ? "border-[var(--nmm-warm)]/30 bg-[var(--nmm-warm)]/5 hover:border-[var(--nmm-warm)]"
      : "border-border bg-card hover:border-foreground/40";

  const accentText =
    slot.available_count === 0
      ? "text-destructive"
      : ratio >= 0.7
      ? "text-accent"
      : ratio >= 0.4
      ? "text-[var(--nmm-warm)]"
      : "text-foreground";

  return (
    <details className={`group rounded-xl border bg-card p-4 transition-colors ${tone}`}>
      <summary className="flex cursor-pointer items-center justify-between gap-3 list-none [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <div className="font-mono text-sm font-medium tabular-nums tracking-tight">
            {label}
          </div>
          <div className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
            {slot.available_count} of {total} free
          </div>
        </div>
        <div className={`shrink-0 text-2xl font-semibold tabular-nums ${accentText}`}>
          {slot.available_count}
        </div>
      </summary>

      {slot.available_emails.length > 0 ? (
        <ul className="mt-3 space-y-1.5 border-t border-border pt-3">
          {slot.available_emails.map((email) => (
            <li key={email}>
              <Link
                href={`/apps/calendar/team/${encodeURIComponent(email)}?date=${date}&tz=${encodeURIComponent(tz)}`}
                className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-secondary"
                title={email}
              >
                <span className="truncate font-medium">{shortName(email)}</span>
                <span className="text-xs text-muted-foreground">view week →</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 border-t border-border pt-3 text-sm italic text-muted-foreground">
          no one available
        </p>
      )}
    </details>
  );
}

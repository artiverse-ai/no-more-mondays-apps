"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function NewSnapshotForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    slug: "",
    runOn: "",
    weekStart: "",
    weekEnd: "",
    reportType: "weekly_recap" as "weekly_recap" | "midweek_check",
    weekLabel: "",
    badge: "",
    latestWebinar: "",
    contextTag: "",
    contextTitle: "",
    contextBody: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/weekly-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data: { slug?: string; error?: string } = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      router.push(`/dashboards/weekly-report/${data.slug}`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="font-heading text-lg font-semibold">New snapshot</h2>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Slug (URL path)" hint="e.g. 2026-05-14 — lowercase letters/digits/hyphens">
          <input required value={form.slug} onChange={set("slug")} placeholder="2026-05-21" pattern="[a-z0-9][a-z0-9-]{0,63}" className={inputCls} />
        </Field>
        <Field label="Report type">
          <select value={form.reportType} onChange={set("reportType")} className={inputCls}>
            <option value="weekly_recap">Weekly recap (Monday)</option>
            <option value="midweek_check">Midweek check (Thursday)</option>
          </select>
        </Field>
        <Field label="Run on" hint="The date the report is generated">
          <input required type="date" value={form.runOn} onChange={set("runOn")} className={inputCls} />
        </Field>
        <Field label="Latest webinar" hint="Optional. e.g. Wed May 13">
          <input value={form.latestWebinar} onChange={set("latestWebinar")} placeholder="Wed May 13" className={inputCls} />
        </Field>
        <Field label="Week start" hint="Sun-Sat for Mondays; Sun for Thursdays">
          <input required type="date" value={form.weekStart} onChange={set("weekStart")} className={inputCls} />
        </Field>
        <Field label="Week end" hint="Sat for Mondays; Wed (yesterday) for Thursdays">
          <input required type="date" value={form.weekEnd} onChange={set("weekEnd")} className={inputCls} />
        </Field>
        <Field label="Week label (header)">
          <input required value={form.weekLabel} onChange={set("weekLabel")} placeholder="Week May 17–23, 2026" className={inputCls} />
        </Field>
        <Field label="Badge">
          <input required value={form.badge} onChange={set("badge")} placeholder="MON MAY 25, 2026" className={inputCls} />
        </Field>
      </div>

      <div className="space-y-3 border-t border-border pt-4">
        <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Context banner (Tab 1, optional)
        </h3>
        <Field label="Context tag">
          <input value={form.contextTag} onChange={set("contextTag")} placeholder="Marketing Context — …" className={inputCls} />
        </Field>
        <Field label="Context title">
          <input value={form.contextTitle} onChange={set("contextTitle")} className={inputCls} />
        </Field>
        <Field label="Context body" hint="Multi-line OK — preserved on render">
          <textarea rows={4} value={form.contextBody} onChange={set("contextBody")} className={`${inputCls} resize-y`} />
        </Field>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Creating…" : "Create snapshot"}
      </button>
    </form>
  );
}

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      {children}
      {hint ? <span className="block text-[10px] text-muted-foreground/80">{hint}</span> : null}
    </label>
  );
}

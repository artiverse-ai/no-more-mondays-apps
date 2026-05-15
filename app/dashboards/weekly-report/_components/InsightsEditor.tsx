"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./report.module.css";

export type GenStatus = "pending" | "generating" | "succeeded" | "failed";

export type InsightTone = "ctx" | "win" | "watch" | "flag" | "fix" | "fwd";

export type EditableInsight = {
  id: string;
  snapshotSlug: string;
  tone: InsightTone;
  tag: string;
  title: string;
  body: string;
  position: number;
};

const TONE_OPTIONS: { value: InsightTone; label: string }[] = [
  { value: "ctx",   label: "Context" },
  { value: "win",   label: "Win" },
  { value: "watch", label: "Watch" },
  { value: "flag",  label: "Flag" },
  { value: "fix",   label: "Fix" },
  { value: "fwd",   label: "Forward" },
];

function classForTone(tone: InsightTone) {
  switch (tone) {
    case "win":   return { card: styles.insWin,   tag: styles.insWinTag };
    case "watch": return { card: styles.insWatch, tag: styles.insWatchTag };
    case "flag":  return { card: styles.insFlag,  tag: styles.insFlagTag };
    case "fix":   return { card: styles.insFix,   tag: styles.insFixTag };
    case "fwd":   return { card: styles.insFwd,   tag: styles.insFwdTag };
    default:      return { card: styles.insCtx,   tag: styles.insCtxTag };
  }
}

export function InsightsEditor({
  snapshotSlug,
  weekLabel,
  latestWebinar,
  initial,
  canEdit,
  initialStatus,
  initialError,
}: {
  snapshotSlug: string;
  weekLabel: string;
  latestWebinar: string | null;
  initial: EditableInsight[];
  canEdit: boolean;
  initialStatus: GenStatus;
  initialError: string | null;
}) {
  const router = useRouter();
  const [insights, setInsights] = useState<EditableInsight[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [genStatus, setGenStatus] = useState<GenStatus>(initialStatus);
  const [genError, setGenError] = useState<string | null>(initialError);
  const lastStatusRef = useRef<GenStatus>(initialStatus);

  // Auto-poll for status while the VM is working. Stops once we land on a
  // terminal state ('succeeded' / 'failed'). On a transition from
  // non-terminal → terminal, refresh the route so the new insights load.
  useEffect(() => {
    if (genStatus !== "pending" && genStatus !== "generating") return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/weekly-reports/${snapshotSlug}`, { cache: "no-store" });
        if (!res.ok) return;
        const data: { snapshot?: { insightsGenerationStatus: GenStatus; insightsGenerationError: string | null } } = await res.json();
        if (cancelled || !data.snapshot) return;
        const next = data.snapshot.insightsGenerationStatus;
        setGenError(data.snapshot.insightsGenerationError);
        if (next !== lastStatusRef.current) {
          lastStatusRef.current = next;
          setGenStatus(next);
          if (next === "succeeded" || next === "failed") {
            router.refresh();
          }
        }
      } catch {
        // ignore network blips — next tick will try again
      }
    };
    const id = setInterval(tick, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, [genStatus, snapshotSlug, router]);

  const regenerate = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/weekly-reports/${snapshotSlug}/regenerate-insights`, { method: "POST" });
      if (!res.ok) {
        const d: { error?: string } = await res.json().catch(() => ({}));
        throw new Error(d.error || `HTTP ${res.status}`);
      }
      setGenStatus("pending");
      setGenError(null);
      lastStatusRef.current = "pending";
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const heading = `Strategic Insights — ${weekLabel}${latestWebinar ? ` / Latest Webinar ${latestWebinar}` : ""}`;

  // While Claude is producing a fresh batch, hide the existing cards
  // entirely so the user never sees a mix of stale and new. Cards reappear
  // when status flips to 'succeeded' or 'failed'.
  const isGenerating = genStatus === "pending" || genStatus === "generating";

  const upsertLocal = (next: EditableInsight) => {
    setInsights((prev) => {
      const idx = prev.findIndex((p) => p.id === next.id);
      if (idx === -1) return [...prev, next].sort((a, b) => a.position - b.position);
      const copy = prev.slice();
      copy[idx] = next;
      return copy.sort((a, b) => a.position - b.position);
    });
  };

  const removeLocal = (id: string) => setInsights((prev) => prev.filter((p) => p.id !== id));

  const remove = async (id: string) => {
    if (!confirm("Delete this insight?")) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/weekly-reports/${snapshotSlug}/insights/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d: { error?: string } = await res.json().catch(() => ({}));
        throw new Error(d.error || `HTTP ${res.status}`);
      }
      removeLocal(id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className={styles.sh} style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <span>{heading}</span>
        {canEdit ? (
          <div style={{ display: "flex", gap: 8 }}>
            {!adding && !isGenerating ? (
              <button
                type="button"
                onClick={() => { setAdding(true); setEditingId(null); }}
                style={btnPrimary}
              >
                + Add insight
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void regenerate()}
              disabled={busy || isGenerating}
              style={btnGhost}
              title="Mark for re-generation — VM cron will pick it up within ~1 min"
            >
              {isGenerating ? "Queued…" : "Regenerate with AI"}
            </button>
          </div>
        ) : null}
      </div>

      <GenStatusBanner status={genStatus} error={genError} />

      {error ? (
        <div style={errorBox}>{error}</div>
      ) : null}

      {/* While Claude is generating, render only the banner above — no cards,
          no add form, no empty-state line. They all reappear when status
          flips to 'succeeded' or 'failed'. */}
      {isGenerating ? null : (
        <>
          {adding ? (
            <InsightForm
              mode="create"
              snapshotSlug={snapshotSlug}
              nextPosition={(insights[insights.length - 1]?.position ?? -1) + 1}
              onCancel={() => setAdding(false)}
              onSaved={(ins) => { upsertLocal(ins); setAdding(false); }}
              onError={setError}
              busy={busy}
              setBusy={setBusy}
            />
          ) : null}

          {insights.length === 0 && !adding ? (
            <p style={{ marginTop: 16, fontFamily: "var(--font-outfit), sans-serif", fontSize: 13, color: "var(--text-muted)" }}>
              No insights authored for this snapshot yet.
            </p>
          ) : null}
        </>
      )}

      <div className={styles.insGrid} style={{ display: isGenerating ? "none" : undefined }}>
        {insights.map((ins) => {
          const { card, tag } = classForTone(ins.tone);
          const isEditing = editingId === ins.id;
          if (isEditing) {
            return (
              <div key={ins.id} className={`${styles.ins} ${card}`} style={{ gridColumn: "1 / -1" }}>
                <InsightForm
                  mode="edit"
                  initial={ins}
                  snapshotSlug={snapshotSlug}
                  onCancel={() => setEditingId(null)}
                  onSaved={(updated) => { upsertLocal(updated); setEditingId(null); }}
                  onError={setError}
                  busy={busy}
                  setBusy={setBusy}
                />
              </div>
            );
          }
          return (
            <div key={ins.id} className={`${styles.ins} ${card}`}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <div className={`${styles.insTag} ${tag}`}>{ins.tag}</div>
                {canEdit ? (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button type="button" onClick={() => { setEditingId(ins.id); setAdding(false); }} style={btnGhost} disabled={busy}>Edit</button>
                    <button type="button" onClick={() => void remove(ins.id)} style={btnGhost} disabled={busy}>Delete</button>
                  </div>
                ) : null}
              </div>
              <h4>{ins.title}</h4>
              <p style={{ whiteSpace: "pre-wrap" }}>{ins.body}</p>
            </div>
          );
        })}
      </div>
    </>
  );
}

function InsightForm({
  mode,
  initial,
  snapshotSlug,
  nextPosition,
  onCancel,
  onSaved,
  onError,
  busy,
  setBusy,
}: {
  mode: "create" | "edit";
  initial?: EditableInsight;
  snapshotSlug: string;
  nextPosition?: number;
  onCancel: () => void;
  onSaved: (ins: EditableInsight) => void;
  onError: (m: string | null) => void;
  busy: boolean;
  setBusy: (b: boolean) => void;
}) {
  const [tone, setTone] = useState<InsightTone>(initial?.tone ?? "ctx");
  const [tag, setTag] = useState(initial?.tag ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [position, setPosition] = useState<number>(initial?.position ?? nextPosition ?? 0);

  const submit = async () => {
    if (!tag.trim() || !title.trim() || !body.trim()) {
      onError("Tag, title, and body are required.");
      return;
    }
    setBusy(true); onError(null);
    try {
      if (mode === "create") {
        const res = await fetch(`/api/weekly-reports/${snapshotSlug}/insights`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tone, tag, title, body, position }),
        });
        const data: { insight?: EditableInsight; error?: string } = await res.json().catch(() => ({}));
        if (!res.ok || !data.insight) throw new Error(data.error || `HTTP ${res.status}`);
        onSaved(data.insight);
      } else {
        const res = await fetch(`/api/weekly-reports/${snapshotSlug}/insights/${initial!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tone, tag, title, body, position }),
        });
        if (!res.ok) {
          const d: { error?: string } = await res.json().catch(() => ({}));
          throw new Error(d.error || `HTTP ${res.status}`);
        }
        onSaved({ ...initial!, tone, tag, title, body, position });
      }
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={formBox}>
      <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 80px", gap: 8 }}>
        <select value={tone} onChange={(e) => setTone(e.target.value as InsightTone)} style={input}>
          {TONE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Tag (e.g. Win — Sales)" style={input} />
        <input type="number" value={position} onChange={(e) => setPosition(Number(e.target.value))} placeholder="Pos" style={input} />
      </div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" style={{ ...input, marginTop: 8 }} />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Body — supports newlines" rows={5} style={{ ...input, marginTop: 8, resize: "vertical" }} />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
        <button type="button" onClick={onCancel} disabled={busy} style={btnGhost}>Cancel</button>
        <button type="button" onClick={() => void submit()} disabled={busy} style={btnPrimary}>
          {busy ? "Saving…" : mode === "create" ? "Add" : "Save"}
        </button>
      </div>
    </div>
  );
}

const input: React.CSSProperties = {
  background: "var(--bg)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  color: "var(--text-primary)",
  padding: 8,
  fontFamily: "var(--font-outfit), sans-serif",
  fontSize: 13,
  width: "100%",
  outline: "none",
};

const formBox: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: 14,
  marginBottom: 16,
};

const btnPrimary: React.CSSProperties = {
  background: "var(--purple)",
  color: "#0a0a0a",
  border: "none",
  borderRadius: 6,
  padding: "6px 14px",
  fontFamily: "var(--font-outfit), sans-serif",
  fontWeight: 600,
  fontSize: 12,
  cursor: "pointer",
};

const btnGhost: React.CSSProperties = {
  background: "none",
  border: "1px solid var(--border)",
  color: "var(--text-secondary)",
  borderRadius: 6,
  padding: "5px 12px",
  fontFamily: "var(--font-outfit), sans-serif",
  fontSize: 12,
  cursor: "pointer",
};

const errorBox: React.CSSProperties = {
  fontSize: 12,
  color: "var(--red)",
  background: "rgba(248, 113, 113, 0.08)",
  border: "1px solid rgba(248, 113, 113, 0.2)",
  borderRadius: 6,
  padding: 10,
  marginBottom: 12,
};

function GenStatusBanner({ status, error }: { status: GenStatus; error: string | null }) {
  if (status === "succeeded") return null;
  const palette: Record<GenStatus, { bg: string; border: string; color: string; label: string; detail: string }> = {
    pending: {
      bg: "rgba(96, 165, 250, 0.08)",
      border: "rgba(96, 165, 250, 0.25)",
      color: "var(--blue)",
      label: "Queued for AI generation",
      detail: "The VM cron picks up pending snapshots every minute. Insights will appear automatically.",
    },
    generating: {
      bg: "rgba(167, 139, 250, 0.08)",
      border: "rgba(167, 139, 250, 0.25)",
      color: "var(--purple)",
      label: "Generating insights with Claude…",
      detail: "Usually 30s to 2 min. This page is auto-polling — no action needed.",
    },
    succeeded: { bg: "", border: "", color: "", label: "", detail: "" },
    failed: {
      bg: "rgba(248, 113, 113, 0.08)",
      border: "rgba(248, 113, 113, 0.25)",
      color: "var(--red)",
      label: "Generation failed",
      detail: error || "Unknown error — check VM logs at ~/data_audit/logs/weekly_insights.log",
    },
  };
  const p = palette[status];
  return (
    <div style={{ background: p.bg, border: `1px solid ${p.border}`, borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontFamily: "var(--font-outfit), sans-serif" }}>
      <div style={{ color: p.color, fontSize: 12, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 4 }}>
        {p.label}
      </div>
      <div style={{ color: "var(--text-secondary)", fontSize: 12 }}>{p.detail}</div>
    </div>
  );
}

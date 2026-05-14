"use client";

import { useState } from "react";
import styles from "./report.module.css";

export function ContextBannerEditor({
  snapshotSlug,
  initialTag,
  initialTitle,
  initialBody,
  canEdit,
}: {
  snapshotSlug: string;
  initialTag: string;
  initialTitle: string;
  initialBody: string;
  canEdit: boolean;
}) {
  const [tag, setTag] = useState(initialTag);
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/weekly-reports/${snapshotSlug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contextTag: tag, contextTitle: title, contextBody: body }),
      });
      if (!res.ok) {
        const d: { error?: string } = await res.json().catch(() => ({}));
        throw new Error(d.error || `HTTP ${res.status}`);
      }
      setEditing(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!tag && !title && !body && !editing && !canEdit) return null;

  if (editing) {
    return (
      <div className={styles.ctxBanner}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Tag (e.g. Marketing Context — …)" style={input} />
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" style={input} />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} placeholder="Body — supports newlines" style={{ ...input, resize: "vertical" }} />
          {error ? <div style={errorBox}>{error}</div> : null}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button type="button" onClick={() => { setEditing(false); setTag(initialTag); setTitle(initialTitle); setBody(initialBody); }} disabled={busy} style={btnGhost}>Cancel</button>
            <button type="button" onClick={() => void save()} disabled={busy} style={btnPrimary}>{busy ? "Saving…" : "Save"}</button>
          </div>
        </div>
      </div>
    );
  }

  const empty = !tag && !title && !body;

  return (
    <div className={styles.ctxBanner}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        {tag ? <div className={styles.ctxTag}>⚙ {tag}</div> : <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{empty ? "No context banner — admin can add one" : null}</span>}
        {canEdit ? <button type="button" onClick={() => setEditing(true)} style={btnGhost}>{empty ? "Add context" : "Edit"}</button> : null}
      </div>
      {title ? <h3>{title}</h3> : null}
      {body ? (
        <div style={{ whiteSpace: "pre-line", marginTop: 8, color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.55 }}>
          {body}
        </div>
      ) : null}
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
  padding: "4px 10px",
  fontFamily: "var(--font-outfit), sans-serif",
  fontSize: 11,
  cursor: "pointer",
};

const errorBox: React.CSSProperties = {
  fontSize: 12,
  color: "var(--red)",
  background: "rgba(248, 113, 113, 0.08)",
  border: "1px solid rgba(248, 113, 113, 0.2)",
  borderRadius: 6,
  padding: 10,
};

"use client";

import { useState } from "react";
import styles from "./report.module.css";

export type Solution = {
  id: string;
  reportWeek: string;
  tab: "marketing" | "sales";
  authorEmail: string;
  authorName: string | null;
  body: string;
  createdAt: string;
  updatedAt: string | null;
};

const fmtET = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

function shortName(email: string, name: string | null): string {
  if (name && name.trim()) return name.trim();
  return email.split("@")[0];
}

export function SolutionsTab({
  reportWeek,
  tab,
  editorEmail,
  initial,
  currentUserEmail,
  currentUserIsAdmin,
}: {
  reportWeek: string;
  tab: "marketing" | "sales";
  editorEmail: string;
  initial: Solution[];
  currentUserEmail: string;
  currentUserIsAdmin: boolean;
}) {
  const [solutions, setSolutions] = useState<Solution[]>(initial);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Per-card edit state — keyed by solution id.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const canPost =
    currentUserEmail.toLowerCase() === editorEmail.toLowerCase() ||
    currentUserIsAdmin;

  const submit = async () => {
    const body = draft.trim();
    if (!body) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/weekly-report/${reportWeek}/solutions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tab, body }),
      });
      const data: { solution?: Solution; error?: string } = await res
        .json()
        .catch(() => ({}));
      if (!res.ok || !data.solution) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setSolutions((prev) => [data.solution!, ...prev]);
      setDraft("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this post?")) return;
    try {
      const res = await fetch(`/api/weekly-report/${reportWeek}/solutions/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data: { error?: string } = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setSolutions((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const startEdit = (s: Solution) => {
    setEditingId(s.id);
    setEditDraft(s.body);
    setError(null);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft("");
  };
  const saveEdit = async (id: string) => {
    const body = editDraft.trim();
    if (!body) return;
    setSavingEdit(true);
    setError(null);
    try {
      const res = await fetch(`/api/weekly-report/${reportWeek}/solutions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data: { solution?: Solution; error?: string } = await res
        .json()
        .catch(() => ({}));
      if (!res.ok || !data.solution) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setSolutions((prev) =>
        prev.map((s) => (s.id === id ? data.solution! : s)),
      );
      setEditingId(null);
      setEditDraft("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingEdit(false);
    }
  };

  const tabTitle = tab === "marketing" ? "Marketing Solutions" : "Sales Solutions";

  return (
    <>
      <div className={styles.sh} style={{ marginBottom: 20 }}>
        {tabTitle} —{" "}
        {canPost ? (
          <span style={{ color: "var(--green)" }}>
            you can post here ({editorEmail})
          </span>
        ) : (
          <span style={{ color: "var(--text-muted)" }}>
            posting restricted to {editorEmail}
          </span>
        )}
      </div>

      {canPost ? (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Post a ${tab} solution — what's the action, who owns it, when?`}
            rows={4}
            style={{
              width: "100%",
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              color: "var(--text-primary)",
              padding: 10,
              fontFamily: "var(--font-outfit), sans-serif",
              fontSize: 13,
              lineHeight: 1.5,
              resize: "vertical",
              outline: "none",
            }}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                void submit();
              }
            }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 10,
              gap: 10,
            }}
          >
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {draft.length} / 5000 · ⌘+Enter to post
            </span>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={submitting || !draft.trim()}
              style={{
                background: "var(--purple)",
                color: "#0a0a0a",
                border: "none",
                borderRadius: 6,
                padding: "8px 18px",
                fontFamily: "var(--font-outfit), sans-serif",
                fontWeight: 600,
                fontSize: 13,
                cursor: submitting || !draft.trim() ? "not-allowed" : "pointer",
                opacity: submitting || !draft.trim() ? 0.5 : 1,
              }}
            >
              {submitting ? "Posting…" : "Post solution"}
            </button>
          </div>
          {error ? (
            <div
              style={{
                marginTop: 10,
                fontSize: 12,
                color: "var(--red)",
                background: "rgba(248, 113, 113, 0.06)",
                border: "1px solid rgba(248, 113, 113, 0.2)",
                borderRadius: 6,
                padding: 8,
              }}
            >
              {error}
            </div>
          ) : null}
        </div>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {solutions.length === 0 ? (
          <div
            style={{
              border: "1px dashed var(--border)",
              borderRadius: 10,
              padding: "32px 20px",
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: 13,
            }}
          >
            No {tab} solutions posted yet for this week.
            {canPost ? null : ` ${editorEmail} hasn't posted anything yet.`}
          </div>
        ) : (
          solutions.map((s) => {
            const isMine =
              currentUserEmail.toLowerCase() === s.authorEmail.toLowerCase();
            const canManage = isMine || currentUserIsAdmin;
            const isEditing = editingId === s.id;
            const edited =
              s.updatedAt && s.updatedAt !== s.createdAt
                ? `(edited ${fmtET.format(new Date(s.updatedAt))} ET)`
                : null;
            return (
              <div
                key={s.id}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderLeft: `3px solid ${
                    tab === "marketing" ? "var(--blue)" : "var(--green)"
                  }`,
                  borderRadius: 10,
                  padding: "14px 18px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    gap: 10,
                    marginBottom: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: 10,
                      minWidth: 0,
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-syne), sans-serif",
                        fontSize: 13,
                        fontWeight: 700,
                        color: "var(--text-primary)",
                      }}
                    >
                      {shortName(s.authorEmail, s.authorName)}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-jetbrains-mono), monospace",
                        fontSize: 10,
                        color: "var(--text-muted)",
                        letterSpacing: 0.3,
                      }}
                    >
                      {fmtET.format(new Date(s.createdAt))} ET
                      {edited ? (
                        <span style={{ marginLeft: 6, color: "var(--text-muted)" }}>
                          {edited}
                        </span>
                      ) : null}
                    </span>
                  </div>
                  {canManage && !isEditing ? (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => startEdit(s)}
                        style={{
                          background: "none",
                          border: "1px solid var(--border)",
                          color: "var(--text-secondary)",
                          cursor: "pointer",
                          fontSize: 11,
                          borderRadius: 4,
                          padding: "2px 8px",
                          fontFamily: "var(--font-outfit), sans-serif",
                        }}
                        title="Edit"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void remove(s.id)}
                        style={{
                          background: "none",
                          border: "1px solid var(--border)",
                          color: "var(--text-muted)",
                          cursor: "pointer",
                          fontSize: 11,
                          borderRadius: 4,
                          padding: "2px 8px",
                          fontFamily: "var(--font-outfit), sans-serif",
                        }}
                        title="Delete"
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                </div>
                {isEditing ? (
                  <div>
                    <textarea
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      rows={4}
                      style={{
                        width: "100%",
                        background: "var(--bg)",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        color: "var(--text-primary)",
                        padding: 10,
                        fontFamily: "var(--font-outfit), sans-serif",
                        fontSize: 13,
                        lineHeight: 1.5,
                        resize: "vertical",
                        outline: "none",
                      }}
                      onKeyDown={(e) => {
                        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                          e.preventDefault();
                          void saveEdit(s.id);
                        } else if (e.key === "Escape") {
                          cancelEdit();
                        }
                      }}
                      autoFocus
                    />
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        marginTop: 8,
                        alignItems: "center",
                        justifyContent: "flex-end",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          color: "var(--text-muted)",
                          marginRight: "auto",
                        }}
                      >
                        ⌘+Enter to save · Esc to cancel
                      </span>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        disabled={savingEdit}
                        style={{
                          background: "none",
                          border: "1px solid var(--border)",
                          color: "var(--text-secondary)",
                          padding: "5px 12px",
                          borderRadius: 4,
                          fontSize: 12,
                          cursor: "pointer",
                          fontFamily: "var(--font-outfit), sans-serif",
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => void saveEdit(s.id)}
                        disabled={savingEdit || !editDraft.trim()}
                        style={{
                          background: "var(--purple)",
                          color: "#0a0a0a",
                          border: "none",
                          borderRadius: 4,
                          padding: "5px 14px",
                          fontFamily: "var(--font-outfit), sans-serif",
                          fontWeight: 600,
                          fontSize: 12,
                          cursor:
                            savingEdit || !editDraft.trim()
                              ? "not-allowed"
                              : "pointer",
                          opacity: savingEdit || !editDraft.trim() ? 0.5 : 1,
                        }}
                      >
                        {savingEdit ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p
                    style={{
                      fontSize: 13,
                      color: "var(--text-secondary)",
                      lineHeight: 1.65,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {s.body}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

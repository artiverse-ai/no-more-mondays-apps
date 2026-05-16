"use client";

import { useEffect, useState } from "react";
import type { EnrichmentMeta } from "../lib/enrich";

// Shows the exact BQ query that was sent to enrich the rows, the params
// inlined as literals so it can be pasted into BigQuery directly, plus
// match stats (emails queried vs rows returned) and any error message.
//
// Visible to all viewers — debugging an enrichment mismatch is too
// common to gate behind an admin flag.
export function BqEnrichInfoButton({ meta }: { meta: EnrichmentMeta | null }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!meta) return null;

  const copy = async () => {
    if (!meta.sql) return;
    try {
      await navigator.clipboard.writeText(meta.sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        title="Show the BQ enrichment query"
        aria-label="Show BQ enrichment query"
        style={{
          marginLeft: 6, width: 16, height: 16, fontSize: 10, fontWeight: 700,
          color: "#3b82f6", background: "rgba(59,130,246,.10)",
          border: "1px solid rgba(59,130,246,.35)", borderRadius: "50%",
          cursor: "pointer", display: "inline-flex", alignItems: "center",
          justifyContent: "center", padding: 0, lineHeight: 1,
          verticalAlign: "middle",
        }}
      >
        i
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="BQ enrichment query"
          onClick={() => setOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 100000,
            background: "rgba(0,0,0,.55)", display: "flex",
            alignItems: "center", justifyContent: "center", padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#0f1320", color: "#e7eefb",
              borderRadius: 12, maxWidth: 920, width: "100%",
              maxHeight: "85vh", display: "flex", flexDirection: "column",
              border: "1px solid rgba(96,165,250,.35)",
              boxShadow: "0 24px 60px rgba(0,0,0,.55)",
            }}
          >
            <div style={{
              padding: "14px 18px",
              borderBottom: "1px solid rgba(255,255,255,.08)",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
            }}>
              <div>
                <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".12em" }}>
                  BigQuery enrichment
                </div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>
                  int_calls_enriched · joined on (email, calendly_created_ts)
                </div>
                {meta.stats ? (
                  <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
                    Emails queried: <strong style={{ color: "#cbd5e1" }}>{meta.stats.emailsQueried}</strong>
                    {" · "}
                    Rows returned: <strong style={{ color: "#cbd5e1" }}>{meta.stats.rowsReturned ?? "—"}</strong>
                    {" · "}
                    Matched in client: <strong style={{ color: "#cbd5e1" }}>{meta.matched}</strong> / {meta.total}
                  </div>
                ) : null}
                {meta.error ? (
                  <div style={{ fontSize: 12, color: "#fca5a5", marginTop: 4 }}>
                    ⚠ Enrichment error: {meta.error}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                style={{
                  background: "transparent", border: "1px solid rgba(255,255,255,.15)",
                  color: "#e7eefb", borderRadius: 6, padding: "4px 10px",
                  fontSize: 12, cursor: "pointer",
                }}
              >
                Esc · Close
              </button>
            </div>

            <div style={{ padding: 18, overflow: "auto" }}>
              {meta.sql ? (
                <>
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    marginBottom: 6, fontSize: 12, color: "#cbd5e1",
                  }}>
                    <span style={{ fontWeight: 500 }}>Resolved SQL (literals inlined)</span>
                    <button
                      type="button"
                      onClick={() => void copy()}
                      style={{
                        fontSize: 11, padding: "3px 10px", borderRadius: 5,
                        border: "1px solid rgba(96,165,250,.4)",
                        background: copied ? "rgba(34,197,94,.18)" : "rgba(59,130,246,.12)",
                        color: copied ? "#86efac" : "#bfdbfe",
                        cursor: "pointer",
                      }}
                    >
                      {copied ? "Copied ✓" : "Copy SQL"}
                    </button>
                  </div>
                  <pre style={{
                    background: "#070a14",
                    border: "1px solid rgba(255,255,255,.05)",
                    borderRadius: 6,
                    padding: "10px 12px",
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
                    fontSize: 11.5,
                    lineHeight: 1.55,
                    whiteSpace: "pre",
                    overflow: "auto",
                    margin: 0,
                  }}>
                    {meta.sql}
                  </pre>
                </>
              ) : (
                <div style={{ fontSize: 13, color: "#94a3b8" }}>
                  No SQL captured (enrichment may not have run yet).
                </div>
              )}
              {meta.matched === 0 && meta.total > 0 && !meta.error ? (
                <div style={{
                  marginTop: 14, padding: 12,
                  border: "1px solid rgba(251,191,36,.35)",
                  background: "rgba(251,191,36,.08)",
                  borderRadius: 6, fontSize: 12, color: "#fcd34d",
                }}>
                  <strong>Zero rows matched.</strong> Common causes:
                  <ul style={{ margin: "6px 0 0 18px" }}>
                    <li>BQ has no rows for these emails + creation timestamps in <code>int_calls_enriched</code>.</li>
                    <li>The dbt sync hasn&apos;t caught up — bookings made in the last ~15 min may be missing.</li>
                    <li>Timestamp formatting mismatch between Calendly API and BQ (rare; both should agree at second precision).</li>
                  </ul>
                  Run the SQL above in BigQuery to confirm where the gap is.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import type { ResolvedMetricSql } from "@/lib/dev-sql";

const BQ_PROJECT = "no-more-mondays-analytics";

function bigqueryConsoleUrl(sql: string): string {
  const b64 = btoa(unescape(encodeURIComponent(sql)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `https://console.cloud.google.com/bigquery?project=${BQ_PROJECT}&j=bq:US&q=${b64}`;
}

/**
 * Info icon shown next to a metric label when Dev Mode is on. Click pops
 * a modal with the exact resolved SQL (parameters substituted), a Copy
 * button, and a deep-link to the BigQuery console.
 */
export function SqlInfoButton({ resolved }: { resolved: ResolvedMetricSql }) {
  const [open, setOpen] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

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

  const copy = async (sql: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(sql);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        title="Show SQL (Dev Mode)"
        aria-label={`Show SQL for ${resolved.label}`}
        style={{
          marginLeft: 6,
          width: 16,
          height: 16,
          fontSize: 10,
          fontFamily: "var(--font-mono), monospace",
          fontWeight: 700,
          color: "#3b82f6",
          background: "rgba(59,130,246,.10)",
          border: "1px solid rgba(59,130,246,.35)",
          borderRadius: "50%",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          lineHeight: 1,
          verticalAlign: "middle",
        }}
      >
        i
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`SQL · ${resolved.label}`}
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
              display: "flex", alignItems: "center", justifyContent: "space-between",
              gap: 12,
            }}>
              <div>
                <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".12em" }}>SQL · Dev Mode</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{resolved.label}</div>
                {resolved.derivation ? (
                  <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
                    Derivation: <code style={{ color: "#cbd5e1" }}>{resolved.derivation}</code>
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
              {resolved.blocks.length === 0 ? (
                <div style={{ fontSize: 13, color: "#94a3b8" }}>
                  No SQL — this metric is a placeholder (see derivation note above).
                </div>
              ) : null}

              {resolved.blocks.map((b, idx) => (
                <div key={idx} style={{ marginBottom: idx < resolved.blocks.length - 1 ? 16 : 0 }}>
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    marginBottom: 6, fontSize: 12, color: "#cbd5e1",
                  }}>
                    <span style={{ fontWeight: 500 }}>{b.label}</span>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => void copy(b.sql, idx)}
                        style={{
                          fontSize: 11, padding: "3px 10px", borderRadius: 5,
                          border: "1px solid rgba(96,165,250,.4)",
                          background: copiedIdx === idx ? "rgba(34,197,94,.18)" : "rgba(59,130,246,.12)",
                          color: copiedIdx === idx ? "#86efac" : "#bfdbfe",
                          cursor: "pointer",
                        }}
                      >
                        {copiedIdx === idx ? "Copied ✓" : "Copy SQL"}
                      </button>
                      <a
                        href={bigqueryConsoleUrl(b.sql)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: 11, padding: "3px 10px", borderRadius: 5,
                          border: "1px solid rgba(255,255,255,.15)",
                          background: "rgba(255,255,255,.04)",
                          color: "#cbd5e1", textDecoration: "none",
                        }}
                      >
                        Open in BigQuery →
                      </a>
                    </div>
                  </div>
                  <pre
                    style={{
                      background: "#070a14",
                      border: "1px solid rgba(255,255,255,.05)",
                      borderRadius: 6,
                      padding: "10px 12px",
                      fontFamily: "var(--font-mono), ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                      fontSize: 11.5,
                      lineHeight: 1.55,
                      whiteSpace: "pre",
                      overflow: "auto",
                      margin: 0,
                    }}
                  >
                    {b.sql}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

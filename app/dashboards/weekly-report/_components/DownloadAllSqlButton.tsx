"use client";

/**
 * Dev-mode-only button rendered in the report header. Dumps every Phase
 * 1 metric's resolved SQL into a single .sql file and triggers a browser
 * download. The full SQL bundle is pre-computed server-side and passed
 * down as a string — the client just wraps it in a Blob.
 */
export function DownloadAllSqlButton({
  sqlBundle,
  filename,
}: {
  sqlBundle: string;
  filename: string;
}) {
  const onClick = () => {
    const blob = new Blob([sqlBundle], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <button
      type="button"
      onClick={onClick}
      title="Download a single .sql file with every Phase 1 metric query for this window"
      style={{
        marginLeft: 8,
        fontSize: 11,
        padding: "4px 10px",
        borderRadius: 6,
        border: "1px solid rgba(59,130,246,.35)",
        background: "rgba(59,130,246,.10)",
        color: "#1d4ed8",
        cursor: "pointer",
        fontWeight: 500,
        textTransform: "uppercase",
        letterSpacing: ".08em",
      }}
    >
      ↓ Download all SQL
    </button>
  );
}

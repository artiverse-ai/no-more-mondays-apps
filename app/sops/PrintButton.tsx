"use client";

export function PrintButton({ label = "Print / save as PDF" }: { label?: string }) {
  return (
    <button type="button" className="sop-btn" onClick={() => window.print()}>
      {label}
    </button>
  );
}

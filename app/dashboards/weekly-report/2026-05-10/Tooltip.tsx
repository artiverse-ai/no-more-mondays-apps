"use client";

import { useEffect, useRef } from "react";

// Single floating tooltip that follows the mouse — same behaviour as the
// original HTML report. Any element with a `data-tip` attribute becomes a
// trigger; the text in that attribute (newlines preserved) is what shows.
// One layer per page; mount it once at the top of the dashboard tree.
export function TooltipLayer() {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    let on = false;

    const position = (e: MouseEvent) => {
      const pad = 12;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const w = box.offsetWidth;
      const h = box.offsetHeight;
      let x = e.clientX - w / 2;
      let y = e.clientY - h - pad;
      if (x < pad) x = pad;
      if (x + w > vw - pad) x = vw - w - pad;
      if (y < pad) y = e.clientY + pad + 8;
      if (y + h > vh - pad) y = vh - h - pad;
      box.style.left = x + "px";
      box.style.top = y + "px";
    };

    const onOver = (e: MouseEvent) => {
      const target = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-tip]");
      if (!target) return;
      box.textContent = target.getAttribute("data-tip") || "";
      box.style.display = "block";
      on = true;
      position(e);
    };
    const onMove = (e: MouseEvent) => {
      if (!on) return;
      const target = (e.target as HTMLElement | null)?.closest("[data-tip]");
      if (target) position(e);
      else {
        box.style.display = "none";
        on = false;
      }
    };
    const onOut = (e: MouseEvent) => {
      const target = (e.target as HTMLElement | null)?.closest("[data-tip]");
      if (target) {
        box.style.display = "none";
        on = false;
      }
    };

    document.addEventListener("mouseover", onOver);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseout", onOut);
    return () => {
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseout", onOut);
    };
  }, []);

  return (
    <div
      ref={boxRef}
      style={{
        position: "fixed",
        zIndex: 99999,
        background: "#0d1424",
        border: "1px solid rgba(96,165,250,.4)",
        padding: "10px 14px",
        borderRadius: 8,
        fontSize: 12,
        maxWidth: 340,
        boxShadow: "0 8px 28px rgba(0,0,0,.55)",
        color: "#f0f0f0",
        fontFamily: "var(--font-outfit), sans-serif",
        lineHeight: 1.55,
        whiteSpace: "pre-line",
        pointerEvents: "none",
        display: "none",
        wordBreak: "break-word",
      }}
    />
  );
}

// Inline "tip" trigger — dotted-underlined text that shows the data-tip on hover.
export function Tip({ tip, children }: { tip: string; children: React.ReactNode }) {
  return (
    <span
      data-tip={tip}
      style={{
        borderBottom: "1px dotted rgba(255,255,255,.25)",
        cursor: "help",
      }}
    >
      {children}
    </span>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// Top progress bar that animates during route transitions. Works by
// intercepting `<a>` clicks on the document — when an internal link is
// clicked we start the bar, and we finish it as soon as the pathname or
// search params change (i.e. the new page has begun rendering).

export function NavProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPath = useRef<string>("");

  // Initialise the path baseline.
  useEffect(() => {
    lastPath.current = pathname + "?" + (searchParams?.toString() ?? "");
  }, []); // intentionally empty — first mount only

  // Finish whenever the URL actually changes.
  useEffect(() => {
    const key = pathname + "?" + (searchParams?.toString() ?? "");
    if (key === lastPath.current) return;
    lastPath.current = key;
    setProgress(100);
    timer.current && clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 200);
  }, [pathname, searchParams]);

  // Intercept document-level clicks on links to start the bar early.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const a = target?.closest("a") as HTMLAnchorElement | null;
      if (!a) return;
      if (a.target === "_blank") return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      // External links — skip.
      if (/^https?:\/\//i.test(href) && !href.startsWith(window.location.origin)) return;
      // Same URL — skip.
      const targetKey = (() => {
        try {
          const u = new URL(href, window.location.origin);
          return u.pathname + "?" + u.searchParams.toString();
        } catch {
          return href;
        }
      })();
      if (targetKey === lastPath.current) return;

      setVisible(true);
      setProgress(15);
      // Trickle upward so it feels alive even if the server takes a while.
      let p = 15;
      const tick = setInterval(() => {
        p = Math.min(p + Math.random() * 10, 85);
        setProgress(p);
      }, 250);
      // Stop ticking when the route changes (handled by the other effect).
      const stop = setTimeout(() => clearInterval(tick), 10000);
      timer.current && clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        clearInterval(tick);
        clearTimeout(stop);
      }, 10000);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  if (!visible && progress === 0) return null;

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        zIndex: 9999,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          width: `${progress}%`,
          height: "100%",
          background: "var(--accent, #5b6e3f)",
          boxShadow: "0 0 8px var(--accent, #5b6e3f)",
          transition:
            progress === 100
              ? "width 200ms ease-out, opacity 200ms ease-out"
              : "width 250ms ease-out",
          opacity: progress === 100 ? 0 : 1,
        }}
      />
    </div>
  );
}

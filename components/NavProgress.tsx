"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useGlobalPending } from "@/lib/nav-progress-context";

// Top progress bar that animates during route transitions. Two signals:
//
//  1. `<a>` clicks intercepted at the document level — covers framework
//     navigation triggered by plain anchors.
//  2. `useGlobalPending()` from `lib/nav-progress-context` — covers
//     `router.push()` calls from filter components (ViewTabs,
//     DateRangePicker, GranularityPicker, etc.) that use `useTransition`.
//
// Either signal starts the bar; the bar finishes when the URL settles.

export function NavProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const globalPending = useGlobalPending();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trickle = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPath = useRef<string>("");

  // Initialise the path baseline.
  useEffect(() => {
    lastPath.current = pathname + "?" + (searchParams?.toString() ?? "");
  }, []); // first mount only

  const beginTrickle = () => {
    setVisible(true);
    setProgress((p) => (p < 15 ? 15 : p));
    if (trickle.current) return;
    let p = 15;
    trickle.current = setInterval(() => {
      p = Math.min(p + Math.random() * 10, 85);
      setProgress(p);
    }, 250);
  };

  const finishBar = () => {
    if (trickle.current) {
      clearInterval(trickle.current);
      trickle.current = null;
    }
    setProgress(100);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 200);
  };

  // Finish whenever the URL actually changes.
  useEffect(() => {
    const key = pathname + "?" + (searchParams?.toString() ?? "");
    if (key === lastPath.current) return;
    lastPath.current = key;
    finishBar();
  }, [pathname, searchParams]);

  // Context signal: filter components transitioning router.push().
  // This effect *synchronizes* local progress UI with the external
  // global-pending counter — the precise scenario the React 19 docs
  // describe as an acceptable setState-in-effect pattern.
  useEffect(() => {
    if (globalPending) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- mirror external nav-progress counter
      beginTrickle();
    } else if (visible) {
      // Counter reached zero but URL might already have changed → just
      // ensure the bar wraps up cleanly.
      finishBar();
    }
    // visible intentionally not in deps — we only react to transitions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalPending]);

  // Intercept document-level link clicks for plain `<a>` navigation.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const a = target?.closest("a") as HTMLAnchorElement | null;
      if (!a) return;
      if (a.target === "_blank") return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      if (/^https?:\/\//i.test(href) && !href.startsWith(window.location.origin)) return;
      const targetKey = (() => {
        try {
          const u = new URL(href, window.location.origin);
          return u.pathname + "?" + u.searchParams.toString();
        } catch {
          return href;
        }
      })();
      if (targetKey === lastPath.current) return;

      beginTrickle();
      // Failsafe: if the URL never changes (e.g. nav was cancelled), wrap
      // up after 10s rather than trickling forever.
      const failsafe = setTimeout(() => {
        if (trickle.current) {
          clearInterval(trickle.current);
          trickle.current = null;
        }
      }, 10000);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => clearTimeout(failsafe), 10000);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // Clean up on unmount.
  useEffect(() => () => {
    if (trickle.current) clearInterval(trickle.current);
    if (timer.current) clearTimeout(timer.current);
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

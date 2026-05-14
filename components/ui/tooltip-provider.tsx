"use client";

// Thin client wrapper around @base-ui/react/tooltip's Provider so the
// root layout (a Server Component) can wrap its children in tooltip
// context without crossing the RSC boundary.
//
// The shared `delay` / `closeDelay` here governs every <InfoTip> across
// the app — once one tooltip opens, hovering a sibling opens it
// instantly (the "group-instant" behavior, Apple-feel).

import { Tooltip } from "@base-ui/react/tooltip";

export function TooltipProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Tooltip.Provider delay={200} closeDelay={100}>
      {children}
    </Tooltip.Provider>
  );
}

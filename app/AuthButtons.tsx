"use client";

import { Show, SignInButton, UserButton } from "@clerk/nextjs";

// Server components can't import Clerk's client-only components directly,
// so they live behind this client boundary.
export function AuthButtons() {
  return (
    <>
      <Show when="signed-in">
        <UserButton />
      </Show>
      <Show when="signed-out">
        <SignInButton>
          <button
            type="button"
            className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground shadow-sm hover:border-accent hover:text-accent"
          >
            Sign in
          </button>
        </SignInButton>
      </Show>
    </>
  );
}

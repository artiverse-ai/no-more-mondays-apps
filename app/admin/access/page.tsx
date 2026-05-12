import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { getAllowed } from "@/lib/clerk-allowlist";
import { AccessClient } from "../AccessClient";

export const metadata = {
  title: "Site access · Admin · No More Mondays",
};

// Header renders instantly. The 3 parallel Clerk API calls happen inside
// `<Suspense>`, so the heading + description appear immediately and the
// table streams in as the data arrives.
export default function AdminAccessPage() {
  return (
    <section className="space-y-5">
      <div className="space-y-2">
        <h2 className="font-heading text-2xl font-semibold tracking-tight">
          Site access
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Emails allowed to sign in via Clerk. Adding here writes to
          Clerk&rsquo;s allowlist and emails them a sign-up link. Once they
          create an account they can access the site.
        </p>
      </div>
      <Suspense fallback={<AccessTableFallback />}>
        <AccessData />
      </Suspense>
    </section>
  );
}

async function AccessData() {
  const user = await getCurrentUser();
  const adminEmail = user?.email ?? "";
  try {
    const allowed = await getAllowed();
    return <AccessClient initial={allowed} adminEmail={adminEmail} />;
  } catch (e) {
    return (
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800">
        <p className="font-medium">Could not load the Clerk allowlist.</p>
        <p className="mt-1 text-xs opacity-90">{(e as Error).message}</p>
        <p className="mt-2 text-xs opacity-90">
          Make sure <code>CLERK_SECRET_KEY</code> is set in Vercel env vars
          and that Restrictions → Allowlist is enabled in the Clerk
          dashboard.
        </p>
      </div>
    );
  }
}

function AccessTableFallback() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="h-24 rounded-2xl border border-border bg-card" />
      <div className="rounded-2xl border border-border bg-card">
        <div className="border-b border-border bg-muted/40 px-4 py-2.5">
          <div className="h-3 w-20 rounded bg-muted/40" />
        </div>
        <ul>
          {[0, 1, 2].map((i) => (
            <li
              key={i}
              className="flex items-center justify-between border-b border-border/60 px-4 py-3 last:border-b-0"
            >
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-48 rounded bg-muted/40" />
              </div>
              <div className="h-6 w-16 rounded-full bg-muted/30" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

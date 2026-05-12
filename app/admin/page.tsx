import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/cf-access";
import { getAllowedEmails } from "@/lib/cloudflare";
import { getClosers } from "@/lib/closers";
import { AdminClient } from "./AdminClient";
import { ClosersClient } from "./ClosersClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin · No More Mondays",
};

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  if (!user.isAdmin) {
    return (
      <main className="mx-auto w-full max-w-xl space-y-4 p-10 text-center">
        <h1 className="font-heading text-2xl font-semibold">Not authorized</h1>
        <p className="text-sm text-muted-foreground">
          You&rsquo;re signed in as{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">{user.email}</code>, but
          only admins can manage this page.
        </p>
        <Link
          href="/"
          className="inline-block text-sm font-medium text-accent underline"
        >
          &larr; Back to home
        </Link>
      </main>
    );
  }

  // Fetch both in parallel; either may error independently (BQ creds vs CF
  // creds). Surface the error inline so the other section still works.
  const [closersResult, accessResult] = await Promise.allSettled([
    getClosers(),
    getAllowedEmails(),
  ]);

  const closers = closersResult.status === "fulfilled" ? closersResult.value : [];
  const closersError =
    closersResult.status === "rejected"
      ? (closersResult.reason as Error).message
      : null;

  const allowedEmails =
    accessResult.status === "fulfilled" ? accessResult.value : [];
  const accessError =
    accessResult.status === "rejected"
      ? (accessResult.reason as Error).message
      : null;

  return (
    <main className="mx-auto w-full max-w-3xl space-y-12 p-6 md:p-10">
      <header className="space-y-2 border-b border-border pb-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
              No More Mondays &middot; Admin
            </p>
            <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">
              Admin
            </h1>
          </div>
          <Link
            href="/"
            className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground hover:text-accent"
          >
            &larr; Home
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">
          Signed in as{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">{user.email}</code>
        </p>
      </header>

      {/* ───────── Closers ───────── */}
      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="font-heading text-xl font-semibold tracking-tight">
            Closers
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            The active-closer roster the booking dashboard reads from. Adding,
            pausing, or removing here writes directly to BigQuery
            (<code className="rounded bg-muted px-1.5 py-0.5 text-xs">
              nmm_calendar.closers
            </code>
            ) and propagates within 5 minutes.
          </p>
        </div>
        {closersError ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Could not load closers: {closersError}
          </div>
        ) : (
          <ClosersClient initial={closers} />
        )}
      </section>

      {/* ───────── Access (Cloudflare) ───────── */}
      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="font-heading text-xl font-semibold tracking-tight">
            Site access
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Emails added here can sign into this site once Cloudflare Access is
            enabled. Currently the site is open to anyone with the URL
            (<code className="rounded bg-muted px-1.5 py-0.5 text-xs">
              SKIP_AUTH=1
            </code>
            ), so this list isn&rsquo;t enforced yet.
          </p>
        </div>
        {accessError ? (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800">
            <p className="font-medium">
              Cloudflare Access integration not configured yet.
            </p>
            <p className="mt-1 text-xs opacity-90">{accessError}</p>
            <p className="mt-2 text-xs opacity-90">
              Set <code>CLOUDFLARE_API_TOKEN</code>, <code>CF_ACCOUNT_ID</code>,
              and <code>CF_ACCESS_GROUP_ID</code> in Vercel env vars to enable.
              See <code>docs/DEPLOY.md</code>.
            </p>
          </div>
        ) : (
          <AdminClient initialEmails={allowedEmails} adminEmail={user.email} />
        )}
      </section>
    </main>
  );
}

import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/cf-access";
import { getAllowedEmails } from "@/lib/cloudflare";
import { AdminClient } from "./AdminClient";

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
          only admins can manage access.
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

  let emails: string[] = [];
  let loadError: string | null = null;
  try {
    emails = await getAllowedEmails();
  } catch (e) {
    loadError = (e as Error).message;
  }

  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 p-6 md:p-10">
      <header className="space-y-2 border-b border-border pb-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
              No More Mondays &middot; Admin
            </p>
            <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">
              Access management
            </h1>
          </div>
          <Link
            href="/"
            className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground hover:text-accent"
          >
            &larr; Home
          </Link>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Emails added here can sign into the site via Cloudflare Access.
          Changes are pushed to Cloudflare immediately and take effect on the
          next sign-in.
        </p>
        <p className="text-xs text-muted-foreground">
          Signed in as{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">{user.email}</code>
        </p>
      </header>

      {loadError ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Could not load allow-list: {loadError}
        </div>
      ) : (
        <AdminClient initialEmails={emails} adminEmail={user.email} />
      )}
    </main>
  );
}

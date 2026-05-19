import { currentUser } from "@clerk/nextjs/server";
import { SignOutButton } from "@clerk/nextjs";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Access denied · No More Mondays",
  robots: { index: false, follow: false },
};

/** Shown to signed-in users whose email isn't on the allowlist.
 *  They stay signed in to Clerk but every protected route bounces
 *  here until an admin adds them via /admin/access. */
export default async function AccessDeniedPage() {
  const user = await currentUser().catch(() => null);
  const email = user?.primaryEmailAddress?.emailAddress ?? "your account";

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="max-w-md text-center">
        <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 text-3xl">
          🔒
        </div>
        <h1 className="mb-3 text-2xl font-bold tracking-tight">
          You don&apos;t have access yet
        </h1>
        <p className="mb-2 text-sm text-zinc-500 dark:text-zinc-400">
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs dark:bg-zinc-800">
            {email}
          </code>{" "}
          is signed in but not on the allowlist for this workspace.
        </p>
        <p className="mb-8 text-sm text-zinc-500 dark:text-zinc-400">
          Ask an admin to add you via <strong>/admin/access</strong>. Once
          they do, sign out and back in.
        </p>
        <SignOutButton redirectUrl="/sign-in">
          <button className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white shadow hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100">
            Sign out
          </button>
        </SignOutButton>
      </div>
    </main>
  );
}

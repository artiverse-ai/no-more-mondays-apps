import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/cf-access";
import { AdminTabs } from "./AdminTabs";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin · No More Mondays",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  if (!user.isAdmin) {
    return (
      <main className="mx-auto w-full max-w-xl space-y-4 p-10 text-center">
        <h1 className="font-heading text-2xl font-semibold">Not authorized</h1>
        <p className="text-sm text-muted-foreground">
          You&rsquo;re signed in as{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">{user.email}</code>,
          but only admins can manage this page.
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

  return (
    <main className="mx-auto w-full max-w-4xl p-6 md:p-10">
      <div className="space-y-8">
        <header className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
                No More Mondays &middot; Admin
              </p>
              <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">
                Admin
              </h1>
              <p className="text-xs text-muted-foreground">
                Signed in as{" "}
                <code className="rounded bg-muted px-1.5 py-0.5">
                  {user.email}
                </code>
              </p>
            </div>
            <Link
              href="/"
              className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground hover:text-accent"
            >
              &larr; Home
            </Link>
          </div>
        </header>

        <AdminTabs />

        {children}
      </div>
    </main>
  );
}

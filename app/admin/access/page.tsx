import { getCurrentUser } from "@/lib/auth";
import { getAllowed } from "@/lib/clerk-allowlist";
import { AccessClient } from "../AccessClient";

export const metadata = {
  title: "Site access · Admin · No More Mondays",
};

export default async function AdminAccessPage() {
  const user = await getCurrentUser();
  const adminEmail = user?.email ?? "";

  let allowed: Awaited<ReturnType<typeof getAllowed>> = [];
  let error: string | null = null;
  try {
    allowed = await getAllowed();
  } catch (e) {
    error = (e as Error).message;
  }

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
      {error ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800">
          <p className="font-medium">
            Could not load the Clerk allowlist.
          </p>
          <p className="mt-1 text-xs opacity-90">{error}</p>
          <p className="mt-2 text-xs opacity-90">
            Make sure <code>CLERK_SECRET_KEY</code> is set in Vercel env vars
            and that Restrictions → Allowlist is enabled in the Clerk
            dashboard.
          </p>
        </div>
      ) : (
        <AccessClient initial={allowed} adminEmail={adminEmail} />
      )}
    </section>
  );
}

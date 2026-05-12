import { getCurrentUser } from "@/lib/cf-access";
import { getAllowedEmails } from "@/lib/cloudflare";
import { AdminClient } from "../AdminClient";

export const metadata = {
  title: "Site access · Admin · No More Mondays",
};

export default async function AdminAccessPage() {
  const user = await getCurrentUser();
  // Layout already gated this, but keep the assertion for the email below.
  const adminEmail = user?.email ?? "";

  let emails: string[] = [];
  let error: string | null = null;
  try {
    emails = await getAllowedEmails();
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
          Emails added here can sign into this site once Cloudflare Access is
          enabled. The site is currently open (
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
            SKIP_AUTH=1
          </code>
          ), so this list isn&rsquo;t enforced yet.
        </p>
      </div>
      {error ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800">
          <p className="font-medium">
            Cloudflare Access integration not configured yet.
          </p>
          <p className="mt-1 text-xs opacity-90">{error}</p>
          <p className="mt-2 text-xs opacity-90">
            Set <code>CLOUDFLARE_API_TOKEN</code>, <code>CF_ACCOUNT_ID</code>,
            and <code>CF_ACCESS_GROUP_ID</code> in Vercel env vars to enable.
            See <code>docs/DEPLOY.md</code>.
          </p>
        </div>
      ) : (
        <AdminClient initialEmails={emails} adminEmail={adminEmail} />
      )}
    </section>
  );
}

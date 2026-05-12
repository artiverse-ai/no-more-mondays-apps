import { SignUp } from "@clerk/nextjs";

export const metadata = {
  title: "Sign up · No More Mondays",
};

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-1 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
            No More Mondays
          </p>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Sign up
          </h1>
          <p className="text-sm text-muted-foreground">
            You need to be invited by an admin.
          </p>
        </div>
        <SignUp appearance={{ elements: { rootBox: "mx-auto" } }} />
      </div>
    </main>
  );
}

import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-cream px-4">
      <div className="mb-10 text-center">
        <h1 className="font-heading text-4xl mb-2">Admin sign in</h1>
        <p className="text-muted-foreground text-sm">
          Magic link only. Allowlisted emails just.
        </p>
      </div>
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-in"
        forceRedirectUrl="/admin"
      />
    </div>
  );
}

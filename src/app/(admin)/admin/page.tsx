import Link from "next/link";

export default function AdminLandingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl">Welcome</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Admin landing coming next. In the meantime, jump straight to the{" "}
          <Link href="/admin/guests" className="underline">
            guest list
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { COUPLE } from "@/lib/site-config";
import { AdminShell } from "@/components/admin/admin-shell";

// Admin pages are auth-gated and rely on a runtime Convex connection;
// they must not be statically prerendered at build.
export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/admin"
            className="font-heading text-xl tracking-tight"
          >
            {COUPLE.groom} {COUPLE.joiner} {COUPLE.bride}
            <span className="ml-3 text-xs uppercase tracking-widest text-muted-foreground font-sans">
              admin
            </span>
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link
              href="/admin"
              className="text-foreground hover:text-foreground/70"
            >
              Guests
            </Link>
            <Link
              href="/admin/import"
              className="text-foreground hover:text-foreground/70"
            >
              Import
            </Link>
            <Link
              href="/admin/settings"
              className="text-foreground hover:text-foreground/70"
            >
              Settings
            </Link>
            <UserButton />
          </nav>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-6 py-8">
        <AdminShell>{children}</AdminShell>
      </main>
    </div>
  );
}

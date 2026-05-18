import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { COUPLE } from "@/lib/site-config";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminNav } from "@/components/admin/admin-nav";
import { LogoMark } from "@/components/site/logo";

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
    <div className="min-h-screen flex flex-col print:bg-white">
      <header className="border-b border-border bg-card print:hidden">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
          <Link
            href="/admin"
            aria-label={`${COUPLE.groom} ${COUPLE.joiner} ${COUPLE.bride} admin`}
            className="flex items-center gap-3 shrink-0 transition-opacity hover:opacity-80"
          >
            <LogoMark size="sm" />
            <span className="hidden sm:inline text-xs uppercase tracking-widest text-muted-foreground font-sans">
              admin
            </span>
          </Link>
          <AdminNav />
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 sm:px-6 py-6 sm:py-8 print:px-0 print:py-0">
        <AdminShell>{children}</AdminShell>
      </main>
    </div>
  );
}

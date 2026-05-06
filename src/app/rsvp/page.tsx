import Link from "next/link";
import { COUPLE, WEDDING } from "@/lib/site-config";
import { RsvpFlow } from "@/components/public/rsvp-flow";

// Public RSVP page is auth-free, but it still needs runtime Convex access
// for the lookup/submit flow. Force-dynamic keeps Next from trying to
// statically prerender the empty form shell.
export const dynamic = "force-dynamic";

export default async function RsvpPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = params.invitation;
  const invitationId = Array.isArray(raw) ? raw[0] : raw;

  return (
    <div className="min-h-screen flex flex-col bg-cream text-charcoal">
      <header className="px-6 py-6 sm:py-8">
        <Link
          href="/"
          className="font-heading text-xl tracking-tight text-charcoal/80 hover:text-charcoal transition-colors"
        >
          {COUPLE.groom} <span className="italic text-blush">{COUPLE.joiner}</span>{" "}
          {COUPLE.bride}
        </Link>
      </header>
      <main className="flex-1 px-6 pb-12 sm:pb-16">
        <div className="mx-auto max-w-xl">
          <div className="text-center mb-10 sm:mb-14">
            <p className="font-sans tracking-[0.4em] uppercase text-[10px] sm:text-xs text-blush mb-3">
              Kindly respond
            </p>
            <h1 className="font-heading text-5xl sm:text-6xl leading-none">
              RSVP
            </h1>
            <div className="mx-auto mt-6 h-px w-16 bg-blush/60" aria-hidden />
            {WEDDING.dateISO && (
              <p className="font-heading italic text-lg sm:text-xl text-muted-foreground mt-4">
                {WEDDING.dateISO}
              </p>
            )}
          </div>
          <RsvpFlow initialInvitationId={invitationId} />
        </div>
      </main>
    </div>
  );
}

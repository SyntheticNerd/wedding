import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { COUPLE, WEDDING } from "@/lib/site-config";
import { ContactForm } from "@/components/public/contact-form";

// Landing page mounts the Convex-backed contact form, which needs the
// ConvexProvider at runtime. Skip the static prerender pass — same
// reason /rsvp and /admin opt out.
export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <div className="flex-1 bg-cream text-charcoal">
      <section className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
        <div className="text-center max-w-xl">
          <p className="font-sans tracking-[0.4em] uppercase text-xs text-muted-foreground mb-6">
            Save the date
          </p>
          <h1 className="font-heading text-6xl sm:text-7xl leading-none">
            {COUPLE.groom}
            <span className="block sm:inline italic font-light text-blush mx-3">
              {COUPLE.joiner}
            </span>
            {COUPLE.bride}
          </h1>
          <p className="font-heading text-2xl text-muted-foreground mt-6 italic">
            {WEDDING.dateISO ?? "More details coming soon"}
          </p>
          <p className="text-sm tracking-widest uppercase mt-3 text-muted-foreground">
            {WEDDING.location}
          </p>
          <div className="mt-12 flex flex-wrap justify-center gap-3">
            <Link
              href="/rsvp"
              style={{
                paddingLeft: "calc(2.5rem + 0.3em)",
                paddingRight: "2.5rem",
              }}
              className={cn(
                buttonVariants({ variant: "default" }),
                "h-12 text-sm tracking-[0.3em] uppercase",
              )}
            >
              RSVP
            </Link>
            <Link
              href="/registry"
              style={{
                paddingLeft: "calc(2.5rem + 0.3em)",
                paddingRight: "2.5rem",
              }}
              className={cn(
                buttonVariants({ variant: "secondary" }),
                "h-12 text-sm tracking-[0.3em] uppercase",
              )}
            >
              Registry
            </Link>
          </div>
        </div>
      </section>

      <section className="px-6 pb-16 sm:pb-24">
        <div className="mx-auto max-w-xl">
          <ContactForm />
        </div>
      </section>

      <footer className="px-6 pb-10 text-center text-[10px] uppercase tracking-widest text-muted-foreground/70">
        <Link href="/admin" className="hover:text-muted-foreground">
          Admin
        </Link>
      </footer>
    </div>
  );
}

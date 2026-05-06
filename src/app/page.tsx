import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { COUPLE, WEDDING } from "@/lib/site-config";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 min-h-screen items-center justify-center bg-cream text-charcoal px-6 py-12">
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
        <div className="mt-12">
          <Link
            href="/rsvp"
            className={
              buttonVariants({ variant: "default" }) +
              " h-12 px-10 text-sm tracking-[0.3em] uppercase"
            }
          >
            RSVP
          </Link>
        </div>
        <div className="mt-12 inline-flex items-center gap-3 text-[10px] uppercase tracking-widest text-muted-foreground/70">
          <span className="block w-12 h-px bg-charcoal/15" />
          <Link href="/admin" className="hover:text-muted-foreground">
            Admin
          </Link>
        </div>
      </div>
    </div>
  );
}

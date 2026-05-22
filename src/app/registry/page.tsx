import { HoneymoonHero } from "@/components/public/honeymoon-hero";
import { RegistryHub } from "@/components/public/registry-hub";
import { RegistryGrid } from "@/components/public/registry-grid";

// Convex-backed components below — skip static prerender.
export const dynamic = "force-dynamic";

export default function RegistryPage() {
  return (
    <div className="flex-1 bg-cream text-charcoal">
      <div className="mx-auto max-w-6xl px-6 py-16 space-y-16">
        <HoneymoonHero />
        <RegistryHub />
        <section className="space-y-6">
          <h3 className="font-heading text-2xl text-center">
            A few of our picks
          </h3>
          <RegistryGrid />
        </section>
      </div>
    </div>
  );
}

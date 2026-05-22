"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/lib/convex";

export function HoneymoonHero() {
  const settings = useQuery(api.settings.publicSettings);
  if (settings === undefined) return null;
  if (settings["honeymoonFund.enabled"] !== true) return null;

  const headline =
    (settings["honeymoonFund.headline"] as string | undefined) ?? "";
  const blurb =
    (settings["honeymoonFund.blurb"] as string | undefined) ?? "";
  const ctaUrl =
    (settings["honeymoonFund.ctaUrl"] as string | undefined) ?? "";
  const ctaLabel =
    (settings["honeymoonFund.ctaLabel"] as string | undefined) ?? "Contribute";

  if (!ctaUrl) return null;

  return (
    <section className="rounded-lg bg-blush/40 border border-blush p-8 sm:p-12 text-center space-y-4">
      {headline && (
        <h2 className="font-heading text-4xl sm:text-5xl">{headline}</h2>
      )}
      {blurb && <p className="text-sm sm:text-base max-w-prose mx-auto">{blurb}</p>}
      <Link
        href={ctaUrl}
        target="_blank"
        rel="noopener"
        className="inline-block bg-charcoal text-cream tracking-[0.3em] uppercase text-xs px-8 py-3 rounded-full hover:bg-charcoal/90"
      >
        {ctaLabel} →
      </Link>
    </section>
  );
}

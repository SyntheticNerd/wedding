"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/lib/convex";

/**
 * Hero countdown to the wedding date. Reads `weddingDate` from public
 * settings (string `YYYY-MM-DD`). Renders fallbacks for unset / past dates.
 *
 * Day diff is computed against local midnight to avoid the "you arrive at
 * 11:59 PM and the number is one off" issue.
 */
export function CountdownHero() {
  const settings = useQuery(api.settings.publicSettings);
  // Capture render time once via lazy useState to satisfy react-hooks/purity.
  const [today] = useState(() => startOfLocalDay(new Date()));

  if (settings === undefined) {
    // Render the same gradient frame to avoid layout shift on hydrate.
    return <Frame days="—" label="Loading…" date="" />;
  }

  const weddingDate =
    typeof settings["weddingDate"] === "string"
      ? (settings["weddingDate"] as string)
      : null;

  if (!weddingDate) {
    return (
      <Frame
        days="—"
        label="Wedding date not set"
        date="Pick one in Settings → Dates."
      />
    );
  }

  const target = startOfLocalDay(new Date(`${weddingDate}T00:00:00`));
  const diffDays = Math.round(
    (target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
  );

  if (diffDays === 0) {
    return (
      <Frame
        days="0"
        label="Today's the day!"
        date={formatDate(target)}
      />
    );
  }
  if (diffDays < 0) {
    return (
      <Frame
        days={String(Math.abs(diffDays))}
        label="Days since the big day"
        date={formatDate(target)}
      />
    );
  }
  return (
    <Frame
      days={String(diffDays)}
      label="Days until"
      date={formatDate(target)}
    />
  );
}

function Frame({
  days,
  label,
  date,
}: {
  days: string;
  label: string;
  date: string;
}) {
  return (
    <section className="rounded-xl bg-gradient-to-br from-blush/60 to-blush/30 border border-blush p-6 sm:p-10 text-center">
      <div className="font-heading text-5xl sm:text-7xl leading-none text-charcoal tabular-nums">
        {days}
      </div>
      <div className="mt-2 text-[10px] sm:text-xs uppercase tracking-[0.18em] text-charcoal/70">
        {label}
      </div>
      {date && (
        <div className="mt-2 text-xs sm:text-sm italic text-charcoal/70">
          {date}
        </div>
      )}
    </section>
  );
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

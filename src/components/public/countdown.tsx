"use client";

import { useEffect, useState } from "react";

type Remaining = { days: number; hours: number; minutes: number };

function remainingUntil(target: number): Remaining {
  const ms = Math.max(0, target - Date.now());
  return {
    days: Math.floor(ms / 86_400_000),
    hours: Math.floor((ms % 86_400_000) / 3_600_000),
    minutes: Math.floor((ms % 3_600_000) / 60_000),
  };
}

/**
 * Public countdown to the wedding day. Renders nothing until mounted to avoid
 * a server/client hydration mismatch (the clock differs by the time it takes
 * to ship the HTML). Updates once a minute — second-level precision is noise.
 */
export function Countdown({ dateISO }: { dateISO: string }) {
  const [y, m, d] = dateISO.split("-").map(Number);
  // 3pm local on the wedding day — a sensible "ceremony-ish" anchor.
  const target = new Date(y, m - 1, d, 15, 0, 0).getTime();
  const [remaining, setRemaining] = useState<Remaining | null>(null);

  useEffect(() => {
    setRemaining(remainingUntil(target));
    const id = setInterval(() => setRemaining(remainingUntil(target)), 60_000);
    return () => clearInterval(id);
  }, [target]);

  // Reserve vertical space pre-mount so the hero doesn't jump.
  if (!remaining) return <div className="mt-10 h-[76px]" aria-hidden />;

  const units: ReadonlyArray<{ label: string; value: number }> = [
    { label: "Days", value: remaining.days },
    { label: "Hours", value: remaining.hours },
    { label: "Minutes", value: remaining.minutes },
  ];

  return (
    <div className="mt-10 flex justify-center gap-8 sm:gap-12">
      {units.map((unit) => (
        <div key={unit.label} className="flex flex-col items-center">
          <span className="font-heading text-4xl sm:text-5xl text-charcoal tabular-nums leading-none">
            {unit.value}
          </span>
          <span className="mt-2 text-[10px] sm:text-xs uppercase tracking-[0.3em] text-sage">
            {unit.label}
          </span>
        </div>
      ))}
    </div>
  );
}

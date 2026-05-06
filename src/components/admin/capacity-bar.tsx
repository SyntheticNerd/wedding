"use client";

import { useQuery } from "convex/react";
import { api } from "@/lib/convex";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shows confirmed seats vs the worst-case maximum if every pending RSVP +
 * every unresolved plus-one says yes. If a venueCapacity is set, the
 * remainder is "available" and the band turns amber/red as the projected
 * max approaches and exceeds capacity.
 */
export function CapacityBar() {
  const rollups = useQuery(api.guests.rollups);
  const settings = useQuery(api.settings.all);

  if (rollups === undefined || settings === undefined) {
    return <Skeleton className="h-20" />;
  }

  const venueCapacity =
    typeof settings.venueCapacity === "number"
      ? (settings.venueCapacity as number)
      : null;
  const confirmed = rollups.confirmed;
  const projected = rollups.projectedMax;
  const potential = Math.max(0, projected - confirmed);

  // Bar denominator: capacity if set, else projected (so the bar always fills).
  const denom = venueCapacity ?? Math.max(projected, 1);
  const confirmedPct = Math.min(100, (confirmed / denom) * 100);
  const potentialPct = Math.min(100 - confirmedPct, (potential / denom) * 100);
  const overflowPct =
    venueCapacity != null && projected > venueCapacity
      ? Math.min(15, ((projected - venueCapacity) / denom) * 100)
      : 0;

  const overCapacity = venueCapacity != null && projected > venueCapacity;
  const nearCapacity =
    venueCapacity != null &&
    !overCapacity &&
    projected >= venueCapacity * 0.9;

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-baseline justify-between">
        <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
          Capacity outlook
        </h3>
        {venueCapacity != null ? (
          <span className="text-xs text-muted-foreground">
            Venue capacity:{" "}
            <span className="text-foreground font-medium tabular-nums">
              {venueCapacity}
            </span>
          </span>
        ) : (
          <a
            href="/admin/settings"
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Set venue capacity →
          </a>
        )}
      </div>

      <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="absolute inset-y-0 left-0 bg-[var(--status-yes)] transition-all"
          style={{ width: `${confirmedPct}%` }}
          aria-label="Confirmed"
        />
        <div
          className={`absolute inset-y-0 transition-all ${
            overCapacity
              ? "bg-[var(--status-no)]/40"
              : nearCapacity
                ? "bg-[var(--status-offline)]/50"
                : "bg-[var(--status-yes)]/30"
          }`}
          style={{ left: `${confirmedPct}%`, width: `${potentialPct}%` }}
          aria-label="Potential"
        />
        {venueCapacity != null && (
          <div
            className="absolute inset-y-0 w-px bg-foreground/40"
            style={{ left: `${(venueCapacity / denom) * 100}%` }}
            aria-label="Capacity"
          />
        )}
        {overflowPct > 0 && (
          <div
            className="absolute inset-y-0 right-0 bg-[var(--status-no)]"
            style={{ width: `${overflowPct}%` }}
            aria-label="Over capacity"
          />
        )}
      </div>

      <p className="text-sm text-foreground tabular-nums">
        <span className="font-medium">{confirmed}</span> confirmed
        {potential > 0 && (
          <>
            {" "}
            ·{" "}
            <span
              className={
                overCapacity
                  ? "text-[var(--status-no)] font-medium"
                  : nearCapacity
                    ? "text-[var(--status-offline)] font-medium"
                    : "text-muted-foreground"
              }
            >
              up to {projected} if all pending say yes
            </span>
          </>
        )}
        {venueCapacity != null && (
          <>
            {" "}
            ·{" "}
            <span className="text-muted-foreground">
              capacity {venueCapacity}
            </span>
            {overCapacity && (
              <span className="ml-1 text-[var(--status-no)] font-medium">
                ({projected - venueCapacity} over)
              </span>
            )}
          </>
        )}
      </p>

      {overCapacity && (
        <p className="text-xs text-[var(--status-no)]">
          You&apos;re projected to exceed the venue capacity if every pending
          guest says yes. Consider tightening plus-one allowances or
          declining late additions.
        </p>
      )}
      {nearCapacity && (
        <p className="text-xs text-[var(--status-offline)]">
          Within 10% of capacity if everyone responds yes — keep an eye on
          new invites.
        </p>
      )}
    </div>
  );
}

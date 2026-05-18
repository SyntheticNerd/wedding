"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/lib/convex";
import { Skeleton } from "@/components/ui/skeleton";

const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

/**
 * Mirrors CapacityBar: committed (filled) + considering (soft band) over
 * a budget denominator. If no budget is set, the denominator is the sum of
 * committed + considering so the bar always fills.
 */
export function BudgetBar() {
  const rollups = useQuery(api.vendors.rollups);
  const settings = useQuery(api.settings.all);

  if (rollups === undefined || settings === undefined) {
    return <Skeleton className="h-20" />;
  }

  const budget =
    typeof settings.weddingBudget === "number"
      ? (settings.weddingBudget as number)
      : null;

  const committed = rollups.committed;
  const considering = rollups.consideringTotal;
  const projected = committed + considering;

  const denom = budget ?? Math.max(projected, 1);
  const committedPct = Math.min(100, (committed / denom) * 100);
  const consideringPct = Math.min(
    100 - committedPct,
    (considering / denom) * 100,
  );
  const overflowPct =
    budget != null && projected > budget
      ? Math.min(15, ((projected - budget) / denom) * 100)
      : 0;

  const overBudget = budget != null && projected > budget;
  const nearBudget =
    budget != null && !overBudget && projected >= budget * 0.9;

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-baseline justify-between">
        <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
          Budget outlook
        </h3>
        {budget != null ? (
          <span className="text-xs text-muted-foreground">
            Budget:{" "}
            <span className="text-foreground font-medium tabular-nums">
              {USD.format(budget)}
            </span>
          </span>
        ) : (
          <Link
            href="/admin/settings"
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Set wedding budget →
          </Link>
        )}
      </div>

      <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="absolute inset-y-0 left-0 bg-[var(--status-yes)] transition-all"
          style={{ width: `${committedPct}%` }}
          aria-label="Committed"
        />
        <div
          className={`absolute inset-y-0 transition-all ${
            overBudget
              ? "bg-[var(--status-no)]/40"
              : nearBudget
                ? "bg-[var(--status-offline)]/50"
                : "bg-[var(--status-yes)]/30"
          }`}
          style={{ left: `${committedPct}%`, width: `${consideringPct}%` }}
          aria-label="Considering"
        />
        {budget != null && (
          <div
            className="absolute inset-y-0 w-px bg-foreground/40"
            style={{ left: `${(budget / denom) * 100}%` }}
            aria-label="Budget"
          />
        )}
        {overflowPct > 0 && (
          <div
            className="absolute inset-y-0 right-0 bg-[var(--status-no)]"
            style={{ width: `${overflowPct}%` }}
            aria-label="Over budget"
          />
        )}
      </div>

      <p className="text-sm text-foreground tabular-nums">
        <span className="font-medium">{USD.format(committed)}</span> committed
        {considering > 0 && (
          <>
            {" · "}
            <span
              className={
                overBudget
                  ? "text-[var(--status-no)] font-medium"
                  : nearBudget
                    ? "text-[var(--status-offline)] font-medium"
                    : "text-muted-foreground"
              }
            >
              up to {USD.format(projected)} if all considering are chosen
            </span>
          </>
        )}
        {budget != null && !overBudget && (
          <>
            {" · "}
            <span className="text-muted-foreground">
              {USD.format(Math.max(0, budget - projected))} remaining
            </span>
          </>
        )}
      </p>

      {overBudget && (
        <p className="text-xs text-[var(--status-no)]">
          Projected to exceed your budget by{" "}
          {USD.format(projected - (budget as number))}. Consider trimming the
          shortlist.
        </p>
      )}
      {nearBudget && (
        <p className="text-xs text-[var(--status-offline)]">
          Within 10% of budget if every considering vendor is chosen.
        </p>
      )}
    </div>
  );
}

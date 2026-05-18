"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/lib/convex";
import { formatUSD } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Tracks committed (chosen) vendor spend against the wedding budget. Unlike
 * CapacityBar, this intentionally excludes "considering" — you don't book
 * every venue/photographer on your shortlist, so summing them inflates the
 * projection. If no budget is set, the bar fills against committed alone.
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

  const denom = budget ?? Math.max(committed, 1);
  const committedPct = Math.min(100, (committed / denom) * 100);
  const overflowPct =
    budget != null && committed > budget
      ? Math.min(15, ((committed - budget) / denom) * 100)
      : 0;

  const overBudget = budget != null && committed > budget;
  const nearBudget =
    budget != null && !overBudget && committed >= budget * 0.9;

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
              {formatUSD(budget)}
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
          className={`absolute inset-y-0 left-0 transition-all ${
            overBudget
              ? "bg-[var(--status-no)]"
              : nearBudget
                ? "bg-[var(--status-offline)]"
                : "bg-[var(--status-yes)]"
          }`}
          style={{ width: `${committedPct}%` }}
          aria-label="Committed"
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
        <span className="font-medium">{formatUSD(committed)}</span> committed
        {budget != null && !overBudget && (
          <>
            {" · "}
            <span className="text-muted-foreground">
              {formatUSD(Math.max(0, budget - committed))} remaining
            </span>
          </>
        )}
      </p>

      {overBudget && (
        <p className="text-xs text-[var(--status-no)]">
          Committed spend is over budget by{" "}
          {formatUSD(committed - (budget as number))}.
        </p>
      )}
      {nearBudget && (
        <p className="text-xs text-[var(--status-offline)]">
          Within 10% of budget on committed spend.
        </p>
      )}
    </div>
  );
}

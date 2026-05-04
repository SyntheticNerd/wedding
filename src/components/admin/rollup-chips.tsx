"use client";

import { useQuery } from "convex/react";
import { api } from "@/lib/convex";
import { Skeleton } from "@/components/ui/skeleton";

export function RollupChips() {
  const rollups = useQuery(api.guests.rollups);

  if (rollups === undefined) {
    return (
      <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    );
  }

  const chips: { label: string; value: number; tone?: string }[] = [
    { label: "Total", value: rollups.total },
    { label: "Bride", value: rollups.bride },
    { label: "Groom", value: rollups.groom },
    { label: "Both", value: rollups.both },
    {
      label: "Yes",
      value: rollups.yes,
      tone: "text-[var(--status-yes)]",
    },
    {
      label: "No",
      value: rollups.no,
      tone: "text-[var(--status-no)]",
    },
    { label: "Pending", value: rollups.pending },
    { label: "Plus-ones", value: rollups.plusOnesYes },
    {
      label: "Headcount",
      value: rollups.attending,
      tone: "text-foreground font-medium",
    },
  ];

  return (
    <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
      {chips.map((chip) => (
        <div
          key={chip.label}
          className="rounded-md border border-border bg-card px-3 py-2"
        >
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {chip.label}
          </div>
          <div
            className={`text-lg font-medium tabular-nums ${chip.tone ?? ""}`}
          >
            {chip.value}
          </div>
        </div>
      ))}
    </div>
  );
}

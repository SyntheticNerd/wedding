"use client";

import { useQuery } from "convex/react";
import { api } from "@/lib/convex";
import { Skeleton } from "@/components/ui/skeleton";

interface Chip {
  label: string;
  value: number;
  tone?: string;
}

export function RollupChips() {
  const rollups = useQuery(api.guests.rollups);

  if (rollups === undefined) {
    return (
      <div className="space-y-3">
        <RowSkeleton count={5} />
        <RowSkeleton count={5} />
      </div>
    );
  }

  const invitations: Chip[] = [
    { label: "Total", value: rollups.total },
    { label: "Bride", value: rollups.bride },
    { label: "Groom", value: rollups.groom },
    { label: "Both", value: rollups.both },
    { label: "Plus-ones allowed", value: rollups.plusOnesAllowed },
  ];

  const attendance: Chip[] = [
    { label: "Yes", value: rollups.yes, tone: "text-[var(--status-yes)]" },
    { label: "No", value: rollups.no, tone: "text-[var(--status-no)]" },
    { label: "Pending", value: rollups.pending },
    { label: "Plus-ones confirmed", value: rollups.plusOnesYes },
    {
      label: "Confirmed seats",
      value: rollups.confirmed,
      tone: "text-foreground font-medium",
    },
  ];

  return (
    <div className="space-y-3">
      <ChipRow title="Invitations" chips={invitations} />
      <ChipRow title="Attendance" chips={attendance} />
    </div>
  );
}

function ChipRow({ title, chips }: { title: string; chips: Chip[] }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 font-medium">
        {title}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {chips.map((chip) => (
          <div
            key={chip.label}
            className="rounded-md border border-border bg-card px-3 py-2"
          >
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {chip.label}
            </div>
            <div
              className={`text-lg tabular-nums ${chip.tone ?? "font-normal"}`}
            >
              {chip.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RowSkeleton({ count }: { count: number }) {
  return (
    <div>
      <Skeleton className="h-3 w-20 mb-1.5" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {Array.from({ length: count }).map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    </div>
  );
}

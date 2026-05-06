"use client";

import { useQuery } from "convex/react";
import { api } from "@/lib/convex";
import type { Id } from "@/lib/convex";
import { Skeleton } from "@/components/ui/skeleton";

export function AuditLog({ guestId }: { guestId: Id<"guests"> }) {
  const log = useQuery(api.guests.auditFor, { guestId });

  if (log === undefined) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
      </div>
    );
  }

  if (log.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No changes recorded yet.</p>
    );
  }

  return (
    <ul className="space-y-3 text-sm">
      {log.map((entry: AuditEntry) => (
        <li
          key={entry._id}
          className="border-l-2 border-muted-foreground/30 pl-3"
        >
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {entry.changedBy === "guest"
                ? "Guest"
                : `Admin${entry.changedByUserId ? ` (${entry.changedByUserId.slice(0, 8)})` : ""}`}
            </span>
            <span>{new Date(entry.changedAt).toLocaleString()}</span>
          </div>
          <ChangeSummary before={entry.before} after={entry.after} />
        </li>
      ))}
    </ul>
  );
}

interface AuditEntry {
  _id: string;
  changedAt: number;
  changedBy: "guest" | "admin";
  changedByUserId?: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

function ChangeSummary({
  before,
  after,
}: {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}) {
  const keys = Array.from(
    new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]),
  );
  const diffs = keys.filter((k) => !same(before?.[k], after?.[k]));
  if (diffs.length === 0) {
    return <p className="text-sm">No detected change.</p>;
  }
  return (
    <ul className="mt-1 space-y-0.5">
      {diffs.map((k) => (
        <li key={k} className="text-xs">
          <span className="font-medium">{k}: </span>
          <span className="text-muted-foreground">
            {fmt(before?.[k])} → {fmt(after?.[k])}
          </span>
        </li>
      ))}
    </ul>
  );
}

function same(a: unknown, b: unknown) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function fmt(v: unknown): string {
  if (v === undefined || v === null || v === "") return "—";
  if (typeof v === "boolean") return v ? "yes" : "no";
  return String(v);
}

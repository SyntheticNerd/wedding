"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/lib/convex";

export function ChecklistCard() {
  const items = useQuery(api.checklist.list);

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-heading text-xl">Checklist</h2>
        <Link
          href="/admin/checklist"
          className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          View →
        </Link>
      </div>

      {items === undefined ? (
        <div className="h-[4.5rem] rounded-lg border border-border bg-card animate-pulse" />
      ) : items.length === 0 ? (
        <Link
          href="/admin/checklist"
          className="block rounded-lg border border-dashed border-border bg-card p-4 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
        >
          No tasks yet — set up your planning checklist →
        </Link>
      ) : (
        <Progress
          done={items.filter((i) => i.done).length}
          total={items.length}
          remaining={items.filter((i) => !i.done).slice(0, 3)}
        />
      )}
    </section>
  );
}

function Progress({
  done,
  total,
  remaining,
}: {
  done: number;
  total: number;
  remaining: { _id: string; title: string }[];
}) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">
          {done} of {total} done
        </span>
        <span className="text-sm text-muted-foreground tabular-nums">
          {percent}%
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-[var(--status-yes)] transition-[width] duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
      {remaining.length > 0 && (
        <ul className="text-xs text-muted-foreground space-y-1 pt-1">
          {remaining.map((r) => (
            <li key={r._id} className="truncate">
              • {r.title}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

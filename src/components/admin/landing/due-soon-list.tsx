"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/lib/convex";
import { formatUSD } from "@/lib/utils";

const DAY_MS = 24 * 60 * 60 * 1000;

export function DueSoonList({ limit = 5 }: { limit?: number }) {
  const rollups = useQuery(api.vendors.rollups);
  // Lazy-init "now" to avoid React-purity lint flag from direct Date.now() in render.
  const [now] = useState(() => Date.now());

  if (rollups === undefined) return null;
  const upcoming = rollups.upcoming30d.slice(0, limit);
  if (upcoming.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
        Due soon
      </h3>
      <ul className="divide-y divide-border">
        {upcoming.map((u) => {
          const days = Math.max(0, Math.round((u.dueAt - now) / DAY_MS));
          return (
            <li key={u.id} className="py-2 flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <Link
                  href={`/admin/vendors/${u.id}`}
                  className="text-sm font-medium hover:underline truncate block"
                >
                  {u.name}
                </Link>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Final · {days} day{days === 1 ? "" : "s"}
                </div>
              </div>
              <div className="text-sm font-medium tabular-nums">
                {formatUSD(u.amount)}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

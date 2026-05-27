"use client";

import Link from "next/link";
import { RollupChips } from "../rollup-chips";
import { CapacityBar } from "../capacity-bar";

export function GuestsCard() {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-heading text-xl">Guests</h2>
        <Link
          href="/admin/guests"
          className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          View →
        </Link>
      </div>
      <RollupChips />
      <CapacityBar />
    </section>
  );
}

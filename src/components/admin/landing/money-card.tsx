"use client";

import Link from "next/link";
import { BudgetBar } from "../budget-bar";
import { DueSoonList } from "./due-soon-list";

export function MoneyCard() {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-heading text-xl">Money</h2>
        <Link
          href="/admin/vendors"
          className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          Vendors →
        </Link>
      </div>
      <BudgetBar />
      <DueSoonList />
    </section>
  );
}

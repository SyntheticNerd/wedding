"use client";

import { useDeferredValue, useState } from "react";
import { BudgetBar } from "@/components/admin/budget-bar";
import {
  VendorToolbar,
  type VendorFilters,
} from "@/components/admin/vendor-toolbar";
import { VendorList } from "@/components/admin/vendor-list";

export default function VendorsPage() {
  const [filters, setFilters] = useState<VendorFilters>({
    search: "",
    category: "all",
    status: "all",
  });

  // Defer the search arg so each keystroke doesn't re-fire the Convex
  // query. React picks a stale value during fast typing and catches up once
  // the user pauses. Category and status are leaf-state changes so they
  // pass through directly.
  const deferredSearch = useDeferredValue(filters.search);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl">Vendors</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track candidates, lock in chosen vendors, and watch the budget.
        </p>
      </div>

      <BudgetBar />
      <VendorToolbar value={filters} onChange={setFilters} />
      <VendorList
        category={filters.category}
        status={filters.status}
        search={deferredSearch}
      />
    </div>
  );
}

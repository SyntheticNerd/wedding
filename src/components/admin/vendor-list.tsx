"use client";

import { useQuery } from "convex/react";
import { api } from "@/lib/convex";
import type { Doc } from "@/lib/convex";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BUNDLED_TAG_TO_CATEGORY,
  CATEGORIES,
  categoryLabel,
  type Category,
  type IncludeTag,
} from "@/lib/vendor-categories";
import { VendorBundledStub, VendorRow } from "./vendor-row";

type Vendor = Doc<"vendors">;

export function VendorList({
  category,
  status,
  search,
  hidePassed = true,
}: {
  category?: Category | "all";
  status?: "considering" | "chosen" | "passed" | "all";
  search?: string;
  hidePassed?: boolean;
}) {
  const rawVendors = useQuery(api.vendors.list, {
    category: category && category !== "all" ? category : undefined,
    status: status && status !== "all" ? status : undefined,
    search: search?.trim() || undefined,
  });
  const rollups = useQuery(api.vendors.rollups);

  if (rawVendors === undefined || rollups === undefined) {
    return <Skeleton className="h-64" />;
  }

  // Hide passed-on vendors by default. Skipped when the user is explicitly
  // viewing the Passed status, so they can always be reached.
  const vendors =
    hidePassed && status !== "passed"
      ? rawVendors.filter((v) => v.status !== "passed")
      : rawVendors;

  if (vendors.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No vendors yet. Click <span className="font-medium">+ Add vendor</span>{" "}
        above to start your shortlist.
      </div>
    );
  }

  const byCategory = new Map<string, Vendor[]>();
  for (const vendor of vendors) {
    const arr = byCategory.get(vendor.category) ?? [];
    arr.push(vendor);
    byCategory.set(vendor.category, arr);
  }

  const bundledByCategory = new Map<string, Vendor[]>();
  for (const vendor of vendors) {
    if (vendor.status !== "chosen") continue;
    for (const tag of vendor.includes) {
      const targetCat = BUNDLED_TAG_TO_CATEGORY[tag as IncludeTag];
      if (!targetCat) continue;
      if (targetCat === vendor.category) continue;
      const arr = bundledByCategory.get(targetCat) ?? [];
      arr.push(vendor);
      bundledByCategory.set(targetCat, arr);
    }
  }

  const orderedCategories = [
    ...CATEGORIES.filter((c) => byCategory.has(c) || bundledByCategory.has(c)),
    ...Array.from(byCategory.keys()).filter(
      (c) => !CATEGORIES.includes(c as Category),
    ),
  ];

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {orderedCategories.map((cat) => {
        const rows = byCategory.get(cat) ?? [];
        const stubs = bundledByCategory.get(cat) ?? [];
        if (rows.length === 0 && stubs.length === 0) return null;
        return (
          <div key={cat}>
            <div className="px-4 py-2 bg-muted/40 text-[11px] uppercase tracking-widest text-muted-foreground font-medium border-b border-border">
              {categoryLabel(cat)}
            </div>
            {stubs.map((source) => (
              <VendorBundledStub
                key={`stub-${cat}-${source._id}`}
                category={cat}
                sourceVendor={source}
              />
            ))}
            {rows.map((vendor) => (
              <VendorRow
                key={vendor._id}
                vendor={vendor}
                confirmedHeadcount={rollups.confirmedHeadcount}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

"use client";

import Link from "next/link";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  STATUSES,
  STATUS_LABELS,
  type Category,
  type VendorStatus,
} from "@/lib/vendor-categories";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type VendorFilters = {
  search: string;
  category: Category | "all";
  status: VendorStatus | "all";
};

export function VendorToolbar({
  value,
  onChange,
}: {
  value: VendorFilters;
  onChange: (next: VendorFilters) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
      <Input
        value={value.search}
        onChange={(e) => onChange({ ...value, search: e.target.value })}
        placeholder="Search vendors…"
        className="max-w-xs"
      />
      <select
        value={value.category}
        onChange={(e) =>
          onChange({ ...value, category: e.target.value as Category | "all" })
        }
        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        aria-label="Filter by category"
      >
        <option value="all">All categories</option>
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {CATEGORY_LABELS[c]}
          </option>
        ))}
      </select>
      <select
        value={value.status}
        onChange={(e) =>
          onChange({
            ...value,
            status: e.target.value as VendorStatus | "all",
          })
        }
        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        aria-label="Filter by status"
      >
        <option value="all">All statuses</option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      <div className="ml-auto flex gap-2">
        <Link
          href="/admin/vendors/bulk"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Bulk add
        </Link>
        <Link
          href="/admin/vendors/new"
          className={cn(buttonVariants({ size: "sm" }))}
        >
          + Add vendor
        </Link>
      </div>
    </div>
  );
}

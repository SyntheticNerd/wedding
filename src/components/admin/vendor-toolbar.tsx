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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
      <Select
        value={value.category}
        onValueChange={(v) =>
          onChange({ ...value, category: v as Category | "all" })
        }
      >
        <SelectTrigger aria-label="Filter by category">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All categories</SelectItem>
          {CATEGORIES.map((c) => (
            <SelectItem key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={value.status}
        onValueChange={(v) =>
          onChange({ ...value, status: v as VendorStatus | "all" })
        }
      >
        <SelectTrigger aria-label="Filter by status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {STATUS_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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

"use client";

import Link from "next/link";
import type { Doc } from "@/lib/convex";
import {
  categoryLabel,
  includeLabel,
  PRICE_UNIT_LABELS,
  type VendorStatus,
} from "@/lib/vendor-categories";

const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

type Vendor = Doc<"vendors">;

const STATUS_CLASSES: Record<VendorStatus, string> = {
  considering: "bg-[var(--status-pending)]/20 text-[var(--status-pending)]",
  chosen: "bg-[var(--status-yes)]/20 text-[var(--status-yes)]",
  passed: "bg-muted text-muted-foreground",
};

export function VendorRow({
  vendor,
  confirmedHeadcount,
}: {
  vendor: Vendor;
  confirmedHeadcount: number;
}) {
  const priceDisplay = renderPrice(vendor, confirmedHeadcount);
  return (
    <Link
      href={`/admin/vendors/${vendor._id}`}
      className="grid grid-cols-[auto_1fr_auto_auto] gap-3 sm:gap-4 items-center px-4 py-3 border-b border-border last:border-b-0 hover:bg-muted/40 transition-colors"
    >
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground bg-muted px-2 py-0.5 rounded-full whitespace-nowrap">
        {categoryLabel(vendor.category, vendor.customCategory)}
      </span>

      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground truncate">
          {vendor.name}
          {vendor.location && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              · {vendor.location}
            </span>
          )}
        </div>
        {vendor.includes.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {vendor.includes.map((tag) => (
              <span
                key={tag}
                className="text-[10px] bg-[var(--accent)]/10 text-[var(--accent)] px-1.5 py-0.5 rounded"
              >
                {includeLabel(tag)}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="text-right tabular-nums">
        <div className="text-sm text-foreground">{priceDisplay.main}</div>
        {priceDisplay.sub && (
          <div className="text-[10px] text-muted-foreground">
            {priceDisplay.sub}
          </div>
        )}
      </div>

      <span
        className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-full whitespace-nowrap ${STATUS_CLASSES[vendor.status]}`}
      >
        {vendor.status}
      </span>
    </Link>
  );
}

export function VendorBundledStub({
  category,
  sourceVendor,
}: {
  category: string;
  sourceVendor: Pick<Vendor, "_id" | "name" | "customCategory" | "category">;
}) {
  return (
    <Link
      href={`/admin/vendors/${sourceVendor._id}`}
      className="grid grid-cols-[auto_1fr_auto_auto] gap-3 sm:gap-4 items-center px-4 py-3 border-b border-border last:border-b-0 opacity-60 hover:opacity-100 hover:bg-muted/40 transition-all"
    >
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground bg-muted px-2 py-0.5 rounded-full whitespace-nowrap">
        {categoryLabel(category)}
      </span>
      <div className="text-sm italic text-muted-foreground truncate">
        — covered by {sourceVendor.name} —
      </div>
      <div className="text-right text-sm text-muted-foreground">incl.</div>
      <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full whitespace-nowrap bg-[var(--status-yes)]/20 text-[var(--status-yes)]">
        bundled
      </span>
    </Link>
  );
}

function renderPrice(
  vendor: Vendor,
  confirmedHeadcount: number,
): { main: string; sub?: string } {
  if (vendor.priceTotal == null) return { main: "—" };
  const unitLabel =
    vendor.priceUnit != null ? PRICE_UNIT_LABELS[vendor.priceUnit] : "flat";
  if (vendor.priceUnit === "per_head") {
    if (confirmedHeadcount === 0) {
      return {
        main: USD.format(vendor.priceTotal),
        sub: `est. — · ${unitLabel}`,
      };
    }
    return {
      main: USD.format(vendor.priceTotal * confirmedHeadcount),
      sub: `est. ${confirmedHeadcount} × ${USD.format(vendor.priceTotal)}`,
    };
  }
  return { main: USD.format(vendor.priceTotal), sub: unitLabel };
}

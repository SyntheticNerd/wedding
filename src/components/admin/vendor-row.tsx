"use client";

import Link from "next/link";
import type { Doc } from "@/lib/convex";
import { formatUSD } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  categoryLabel,
  includeLabel,
  PRICE_UNIT_LABELS,
} from "@/lib/vendor-categories";
import { VendorStatusPicker } from "./vendor-status-picker";

type Vendor = Doc<"vendors">;

export function VendorRow({
  vendor,
  confirmedHeadcount,
}: {
  vendor: Vendor;
  confirmedHeadcount: number;
}) {
  const priceDisplay = renderPrice(vendor, confirmedHeadcount);
  // The status picker is a <button> (DropdownMenuTrigger); nesting it inside
  // <a> is invalid. Wrap only the first three columns in <Link> via
  // className="contents", then render the picker as a grid sibling.
  return (
    <div className="grid grid-cols-[auto_1fr_auto_auto] gap-3 sm:gap-4 items-center px-4 py-3 border-b border-border last:border-b-0 hover:bg-muted/40 transition-colors">
      <Link
        href={`/admin/vendors/${vendor._id}`}
        className="contents [&>*]:cursor-pointer"
      >
        <Badge
          variant="secondary"
          className="text-[10px] uppercase tracking-widest bg-muted text-muted-foreground"
        >
          {categoryLabel(vendor.category, vendor.customCategory)}
        </Badge>

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
      </Link>

      <VendorStatusPicker vendorId={vendor._id} status={vendor.status} />
    </div>
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
      <Badge variant="secondary" className="text-[10px] uppercase tracking-widest bg-muted text-muted-foreground">
        {categoryLabel(category)}
      </Badge>
      <div className="text-sm italic text-muted-foreground truncate">
        — covered by {sourceVendor.name} —
      </div>
      <div className="text-right text-sm text-muted-foreground">incl.</div>
      <Badge className="bg-[var(--status-yes)] text-white hover:bg-[var(--status-yes)]/90 text-[10px] uppercase tracking-widest">
        bundled
      </Badge>
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
        main: formatUSD(vendor.priceTotal),
        sub: `est. — · ${unitLabel}`,
      };
    }
    return {
      main: formatUSD(vendor.priceTotal * confirmedHeadcount),
      sub: `est. ${confirmedHeadcount} × ${formatUSD(vendor.priceTotal)}`,
    };
  }
  return { main: formatUSD(vendor.priceTotal), sub: unitLabel };
}

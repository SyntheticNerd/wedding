"use client";

import { useTransition } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/lib/convex";
import type { Id } from "@/lib/convex";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  STATUSES,
  STATUS_LABELS,
  type VendorStatus,
} from "@/lib/vendor-categories";
import { VendorStatusBadge } from "./vendor-status-badge";

/**
 * Click-to-change status badge. Wraps VendorStatusBadge in a dropdown so
 * the user can flip considering / chosen / passed without entering edit
 * mode. Used on both the list row and detail header.
 */
export function VendorStatusPicker({
  vendorId,
  status,
}: {
  vendorId: Id<"vendors">;
  status: VendorStatus;
}) {
  const setStatus = useMutation(api.vendors.setStatus);
  const [pending, startTransition] = useTransition();

  function onPick(next: VendorStatus) {
    if (next === status) return;
    startTransition(async () => {
      try {
        await setStatus({ id: vendorId, status: next });
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Status change failed",
        );
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        // Stop click from bubbling to a parent <Link> on the list row.
        onClick={(e) => e.stopPropagation()}
        disabled={pending}
        aria-label={`Change status (currently ${STATUS_LABELS[status]})`}
        className="inline-flex items-center rounded-4xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50 hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <VendorStatusBadge status={status} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="min-w-32">
        {STATUSES.map((s) => (
          <DropdownMenuItem
            key={s}
            onClick={() => onPick(s)}
            data-current={s === status ? "" : undefined}
            className="data-[current]:font-medium"
          >
            {STATUS_LABELS[s]}
            {s === status && (
              <span className="ml-auto text-muted-foreground text-xs">✓</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

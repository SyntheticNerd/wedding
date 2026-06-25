"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Check, Pencil, Store, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/convex";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { categoryLabel } from "@/lib/vendor-categories";
import { ChecklistEditDialog } from "./checklist-edit-dialog";

export type ChecklistListItem =
  FunctionReturnType<typeof api.checklist.list>[number];

const DAY_MS = 24 * 60 * 60 * 1000;

export function ChecklistItemRow({ item }: { item: ChecklistListItem }) {
  const setDone = useMutation(api.checklist.setDone);
  const remove = useMutation(api.checklist.remove);
  const { confirm, confirmDialog } = useConfirm();
  const [editing, setEditing] = useState(false);
  const [now] = useState(() => Date.now());

  async function toggle() {
    try {
      await setDone({ id: item._id, done: !item.done });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  async function del() {
    const ok = await confirm({
      title: `Delete "${item.title}"?`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await remove({ id: item._id });
      toast.success("Deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  const due = item.dueAt;
  const dueDays =
    due != null ? Math.round((due - now) / DAY_MS) : null;
  const dueOverdue = dueDays != null && dueDays < 0 && !item.done;
  const dueSoon = dueDays != null && dueDays >= 0 && dueDays <= 14 && !item.done;

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      {confirmDialog}
      <Checkbox
        checked={item.done}
        onCheckedChange={toggle}
        aria-label={item.done ? "Mark as not done" : "Mark as done"}
        className="mt-0.5"
      />

      <div className="flex-1 min-w-0">
        <div
          className={cn(
            "text-sm leading-snug",
            item.done && "line-through text-muted-foreground",
          )}
        >
          {item.title}
        </div>

        {(item.vendor || due != null || item.notes) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {item.vendor && <VendorPill item={item} />}

            {due != null && (
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] tabular-nums",
                  dueOverdue
                    ? "bg-[var(--status-no)]/10 text-[var(--status-no)]"
                    : dueSoon
                      ? "bg-[var(--status-pending)]/10 text-[var(--status-pending)]"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {formatDue(due, dueDays, item.done)}
              </span>
            )}

            {item.notes && (
              <span className="text-[11px] text-muted-foreground truncate max-w-[20rem]">
                {item.notes}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setEditing(true)}
          aria-label="Edit task"
        >
          <Pencil className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={del}
          aria-label="Delete task"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      {editing && (
        <ChecklistEditDialog
          item={item}
          open={editing}
          onOpenChange={setEditing}
        />
      )}
    </div>
  );
}

/**
 * The tie to the vendor board. Chosen → green pill linking straight to the
 * vendor. Otherwise a muted prompt linking to the vendor list to pick one.
 */
function VendorPill({ item }: { item: ChecklistListItem }) {
  const vendor = item.vendor;
  if (!vendor || !item.category) return null;
  const label = categoryLabel(item.category);

  if (vendor.status === "chosen" && vendor.chosenId) {
    return (
      <Link
        href={`/admin/vendors/${vendor.chosenId}`}
        className="inline-flex items-center gap-1 rounded-full bg-[var(--status-yes)]/10 px-2 py-0.5 text-[11px] font-medium text-[var(--status-yes)] hover:bg-[var(--status-yes)]/20 transition-colors"
        title={`Chosen: ${vendor.chosenName}`}
      >
        <Check className="size-3" />
        {vendor.chosenName}
      </Link>
    );
  }

  if (vendor.status === "considering") {
    return (
      <Link
        href="/admin/vendors"
        className="inline-flex items-center gap-1 rounded-full bg-[var(--status-pending)]/10 px-2 py-0.5 text-[11px] font-medium text-[var(--status-pending)] hover:bg-[var(--status-pending)]/20 transition-colors"
      >
        <Store className="size-3" />
        {label} · {vendor.consideringCount} in the running
      </Link>
    );
  }

  return (
    <Link
      href="/admin/vendors"
      className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
    >
      <Store className="size-3" />
      {label} · pick a vendor
    </Link>
  );
}

function formatDue(
  dueAt: number,
  dueDays: number | null,
  done: boolean,
): string {
  const date = new Date(dueAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  if (done || dueDays == null) return `Due ${date}`;
  if (dueDays < 0) return `${Math.abs(dueDays)}d overdue`;
  if (dueDays === 0) return "Due today";
  return `Due ${date} · ${dueDays}d`;
}

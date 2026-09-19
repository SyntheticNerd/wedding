"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/lib/convex";
import type { Doc, Id } from "@/lib/convex";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  PRIORITY_LEVELS,
  priorityMeta,
  type GuestPriority,
} from "./guest-priority";
import {
  GuestMobileRow,
  GuestDesktopRow,
  SIDE_LABEL,
} from "./guest-rows";
import { GuestGroups } from "./guest-groups";
import { BulkEditDialog } from "./bulk-edit-dialog";
import { GuestPrintSheet } from "./guest-print-sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Plus, Download, Printer, X } from "lucide-react";
import Papa from "papaparse";

type Side = "bride" | "groom" | "both" | "all";
type StatusFilter = "all" | "pending" | "yes" | "no";
type PriorityFilter = "all" | GuestPriority | "untriaged";

export function GuestTable() {
  const [search, setSearch] = useState("");
  const [side, setSide] = useState<Side>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [priority, setPriority] = useState<PriorityFilter>("all");
  const [selected, setSelected] = useState<Set<Id<"guests">>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [groupByHousehold, setGroupByHousehold] = useState(false);
  const [pending, startTransition] = useTransition();
  const bulkSoftDelete = useMutation(api.guests.bulkSoftDelete);
  const setGuestPriority = useMutation(api.guests.setPriority);
  const { confirm, confirmDialog } = useConfirm();

  const allGuests = useQuery(api.guests.list, {
    side: side === "all" ? undefined : side,
    status: status === "all" ? undefined : status,
    search: search.trim() || undefined,
  }) as Doc<"guests">[] | undefined;

  // Priority is filtered client-side: the "untriaged" case (field absent) is
  // awkward to express as a single Convex union arg, and the list is small.
  const guests = useMemo(() => {
    if (!allGuests) return allGuests;
    if (priority === "all") return allGuests;
    if (priority === "untriaged") {
      return allGuests.filter((g) => g.priority === undefined);
    }
    return allGuests.filter((g) => g.priority === priority);
  }, [allGuests, priority]);

  function onSetPriority(id: Id<"guests">, next?: GuestPriority) {
    startTransition(async () => {
      try {
        await setGuestPriority({ id, priority: next });
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Couldn't set priority",
        );
      }
    });
  }

  // When filters change, drop any selection that's no longer visible — keeps
  // the action bar count honest with what the user can actually see.
  const visibleIds = useMemo(
    () => new Set((guests ?? []).map((g) => g._id)),
    [guests],
  );
  const selectedVisible = useMemo(
    () =>
      Array.from(selected).filter((id) => visibleIds.has(id)) as Id<"guests">[],
    [selected, visibleIds],
  );
  const selectionCount = selectedVisible.length;
  const allVisibleSelected =
    !!guests && guests.length > 0 && selectionCount === guests.length;
  const someVisibleSelected = selectionCount > 0 && !allVisibleSelected;

  function toggleOne(id: Id<"guests">) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (!guests) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const g of guests) next.delete(g._id);
      } else {
        for (const g of guests) next.add(g._id);
      }
      return next;
    });
  }

  function toggleMany(ids: Id<"guests">[], select: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (select) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function onBulkDelete() {
    if (selectionCount === 0) return;
    const ok = await confirm({
      title: `Delete ${selectionCount} guest${selectionCount === 1 ? "" : "s"}?`,
      description:
        "This is reversible — they'll show up in deleted-guests views.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      try {
        const result = await bulkSoftDelete({ ids: selectedVisible });
        toast.success(
          `Deleted ${result.deleted} guest${result.deleted === 1 ? "" : "s"}.`,
        );
        clearSelection();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Bulk delete failed");
      }
    });
  }

  const headerActions = useMemo(
    () => (
      <div className="flex items-center gap-2">
        <Link
          href="/admin/guests/new"
          className={cn(buttonVariants({ size: "sm" }))}
        >
          <Plus className="size-4" />
          Add guest
        </Link>
        <Button
          size="sm"
          variant="outline"
          onClick={() => exportCsv(guests ?? [])}
          disabled={!guests || guests.length === 0}
        >
          <Download className="size-4" />
          Export CSV
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => window.print()}
          disabled={!guests || guests.length === 0}
        >
          <Printer className="size-4" />
          Print
        </Button>
      </div>
    ),
    [guests],
  );

  // Printed-roster header bits. printedOn is set after mount (not during render)
  // so the server- and first-client-render markup match — no hydration drift
  // across a midnight boundary. It's only shown inside the print-only sheet.
  const [printedOn, setPrintedOn] = useState("");
  useEffect(() => {
    // Client-only date, set post-mount to avoid an SSR/hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPrintedOn(
      new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    );
  }, []);
  const filterLabel = useMemo(() => {
    const parts: string[] = [];
    if (side !== "all") parts.push(SIDE_LABEL[side]);
    if (status !== "all") parts.push(`RSVP: ${status}`);
    if (priority === "untriaged") parts.push("Untriaged");
    else if (priority !== "all") parts.push(priorityMeta(priority).label);
    if (search.trim()) parts.push(`"${search.trim()}"`);
    return parts.join(" · ");
  }, [side, status, priority, search]);

  return (
    <>
    <div className="space-y-4 print:hidden">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="flex flex-1 flex-col sm:flex-row gap-2">
          <Input
            placeholder="Search name, alias, email, or invitation"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:max-w-sm"
          />
          <Select value={side} onValueChange={(v) => setSide(v as Side)}>
            <SelectTrigger className="sm:w-40">
              <SelectValue placeholder="Side" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sides</SelectItem>
              <SelectItem value="bride">Bride</SelectItem>
              <SelectItem value="groom">Groom</SelectItem>
              <SelectItem value="both">Both</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as StatusFilter)}
          >
            <SelectTrigger className="sm:w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="yes">Yes</SelectItem>
              <SelectItem value="no">No</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={priority}
            onValueChange={(v) => setPriority(v as PriorityFilter)}
          >
            <SelectTrigger className="sm:w-40">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              {PRIORITY_LEVELS.map((meta) => (
                <SelectItem key={meta.value} value={meta.value}>
                  {meta.label}
                </SelectItem>
              ))}
              <SelectItem value="untriaged">Untriaged</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {headerActions}
      </div>

      {/* View toggle — mobile-first: right-aligned, large tap target. */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground tabular-nums">
          {guests === undefined
            ? ""
            : `${guests.length} guest${guests.length === 1 ? "" : "s"}`}
        </p>
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none py-1">
          <Checkbox
            checked={groupByHousehold}
            onCheckedChange={(v) => setGroupByHousehold(v === true)}
            aria-label="Group by household"
          />
          Group by household
        </label>
      </div>

      {groupByHousehold ? (
        guests === undefined ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={`g-s${i}`} className="h-28" />
            ))}
          </div>
        ) : (
          <GuestGroups
            guests={guests}
            selected={selected}
            onToggle={toggleOne}
            onToggleMany={toggleMany}
            onSetPriority={onSetPriority}
            pending={pending}
          />
        )
      ) : (
        <>
      {/* Mobile: card list — desktop's 6-col table is unscannable on a phone */}
      <ul className="sm:hidden divide-y divide-border rounded-md border border-border bg-card">
        {guests === undefined ? (
          Array.from({ length: 5 }).map((_, i) => (
            <li key={`m-s${i}`} className="p-3">
              <Skeleton className="h-5 w-2/3 mb-2" />
              <Skeleton className="h-3 w-1/2" />
            </li>
          ))
        ) : guests.length === 0 ? (
          <li className="text-center py-12 text-muted-foreground text-sm">
            {search.trim() ||
            side !== "all" ||
            status !== "all" ||
            priority !== "all"
              ? "No guests match these filters."
              : "No guests yet — add your first one."}
          </li>
        ) : (
          guests.map((g) => (
            <GuestMobileRow
              key={g._id}
              guest={g}
              checked={selected.has(g._id)}
              onToggle={toggleOne}
              onSetPriority={onSetPriority}
              pending={pending}
            />
          ))
        )}
      </ul>

      {/* Desktop: full table */}
      <div className="hidden sm:block rounded-md border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allVisibleSelected}
                  indeterminate={someVisibleSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Select all visible guests"
                  disabled={!guests || guests.length === 0}
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Side</TableHead>
              <TableHead>Invitation</TableHead>
              <TableHead>RSVP</TableHead>
              <TableHead>Plus-one</TableHead>
              <TableHead className="text-right">Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {guests === undefined ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={`s${i}`}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : guests.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center py-12 text-muted-foreground"
                >
                  {search.trim() ||
                  side !== "all" ||
                  status !== "all" ||
                  priority !== "all"
                    ? "No guests match these filters."
                    : "No guests yet — add your first one."}
                </TableCell>
              </TableRow>
            ) : (
              guests.map((g) => (
                <GuestDesktopRow
                  key={g._id}
                  guest={g}
                  checked={selected.has(g._id)}
                  onToggle={toggleOne}
                  onSetPriority={onSetPriority}
                  pending={pending}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
        </>
      )}

      {/* Sticky bulk-action bar — bottom of viewport on every breakpoint. */}
      {selectionCount > 0 && (
        <div
          className={cn(
            "fixed left-0 right-0 bottom-0 z-40 px-4",
            "pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3",
          )}
          role="region"
          aria-label="Bulk actions"
        >
          <div className="mx-auto max-w-2xl flex items-center gap-2 rounded-full border border-border bg-card shadow-lg px-3 py-2">
            <span className="text-sm font-medium tabular-nums px-2">
              {selectionCount} selected
            </span>
            <div className="ml-auto flex items-center gap-1.5">
              <Button
                size="sm"
                onClick={() => setBulkEditOpen(true)}
                disabled={pending}
              >
                Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onBulkDelete}
                disabled={pending}
                className="text-[var(--status-no)] border-[var(--status-no)]/40 hover:bg-[var(--status-no)]/10"
              >
                Delete
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={clearSelection}
                disabled={pending}
                aria-label="Clear selection"
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Keep the floating action bar from covering the last row. */}
      {selectionCount > 0 && <div aria-hidden className="h-20" />}

      <BulkEditDialog
        open={bulkEditOpen}
        onOpenChange={setBulkEditOpen}
        ids={selectedVisible}
        onApplied={() => {
          setBulkEditOpen(false);
          clearSelection();
        }}
      />
      {confirmDialog}
    </div>

    {/* Print-only formatted roster — reflects the current filtered set. */}
    <GuestPrintSheet
      guests={guests ?? []}
      filterLabel={filterLabel}
      printedOn={printedOn}
    />
    </>
  );
}

function exportCsv(guests: Doc<"guests">[]) {
  const rows = guests.map((g) => ({
    firstName: g.firstName,
    lastName: g.lastName,
    aliases: g.aliases.join("|"),
    phoneE164: g.phoneE164 ?? "",
    email: g.email ?? "",
    invitationId: g.invitationId,
    side: g.side,
    priority: g.priority ?? "",
    isChild: g.isChild ? "true" : "false",
    rsvpStatus: g.rsvpStatus,
    rsvpOffline: g.rsvpOffline ? "true" : "false",
    plusOneAllowed: g.plusOneAllowed ? "true" : "false",
    plusOneName: g.plusOneName ?? "",
    plusOneRsvp: g.plusOneRsvp ?? "",
    dietaryNotes: g.dietaryNotes ?? "",
    noteToCouple: g.noteToCouple ?? "",
    adminNotes: g.adminNotes ?? "",
    address: g.address
      ? `${g.address.line1}${g.address.line2 ? ", " + g.address.line2 : ""}, ${g.address.city}, ${g.address.region} ${g.address.postalCode} ${g.address.country}`
      : "",
  }));
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `wedding-guests-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

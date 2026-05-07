"use client";

import { useMemo, useState, useTransition } from "react";
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
import { RsvpStatusBadge } from "./rsvp-status-badge";
import { BulkEditDialog } from "./bulk-edit-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Download, X } from "lucide-react";
import Papa from "papaparse";

type Side = "bride" | "groom" | "both" | "all";
type StatusFilter = "all" | "pending" | "yes" | "no";

const SIDE_LABEL: Record<Exclude<Side, "all">, string> = {
  bride: "Bride",
  groom: "Groom",
  both: "Both",
};

export function GuestTable() {
  const [search, setSearch] = useState("");
  const [side, setSide] = useState<Side>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [selected, setSelected] = useState<Set<Id<"guests">>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const bulkSoftDelete = useMutation(api.guests.bulkSoftDelete);

  const guests = useQuery(api.guests.list, {
    side: side === "all" ? undefined : side,
    status: status === "all" ? undefined : status,
    search: search.trim() || undefined,
  }) as Doc<"guests">[] | undefined;

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

  function clearSelection() {
    setSelected(new Set());
  }

  function onBulkDelete() {
    if (selectionCount === 0) return;
    if (
      !confirm(
        `Delete ${selectionCount} guest${selectionCount === 1 ? "" : "s"}? This is reversible — they'll show up in deleted-guests views.`,
      )
    ) {
      return;
    }
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
      </div>
    ),
    [guests],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="flex flex-1 flex-col sm:flex-row gap-2">
          <Input
            placeholder="Search by name, alias, or email"
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
        </div>
        {headerActions}
      </div>

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
            {search.trim() || side !== "all" || status !== "all"
              ? "No guests match these filters."
              : "No guests yet — add your first one."}
          </li>
        ) : (
          guests.map((g) => {
            const checked = selected.has(g._id);
            return (
              <li key={g._id} className="flex items-stretch">
                <div className="flex items-center justify-center px-4">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleOne(g._id)}
                    aria-label={`Select ${g.firstName} ${g.lastName}`}
                  />
                </div>
                <Link
                  href={`/admin/guests/${g._id}`}
                  className="flex-1 flex items-start justify-between gap-3 p-3 active:bg-muted/50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">
                      {g.firstName} {g.lastName}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span>{SIDE_LABEL[g.side]}</span>
                      <span aria-hidden>·</span>
                      <span className="font-mono">{g.invitationId}</span>
                      {g.plusOneAllowed && (
                        <>
                          <span aria-hidden>·</span>
                          <span>+1 allowed</span>
                        </>
                      )}
                    </div>
                    {g.aliases.length > 0 && (
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">
                        aka {g.aliases.join(", ")}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0">
                    <RsvpStatusBadge
                      status={g.rsvpStatus}
                      offline={g.rsvpOffline}
                    />
                  </div>
                </Link>
              </li>
            );
          })
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
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : guests.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-12 text-muted-foreground"
                >
                  {search.trim() || side !== "all" || status !== "all"
                    ? "No guests match these filters."
                    : "No guests yet — add your first one."}
                </TableCell>
              </TableRow>
            ) : (
              guests.map((g) => {
                const checked = selected.has(g._id);
                return (
                  <TableRow
                    key={g._id}
                    className={cn(
                      "cursor-pointer",
                      checked && "bg-muted/40",
                    )}
                    onClick={(e) => {
                      // Clicking the checkbox cell toggles selection;
                      // anywhere else navigates to the guest detail.
                      const target = e.target as HTMLElement;
                      if (target.closest("[data-row-checkbox]")) return;
                      window.location.href = `/admin/guests/${g._id}`;
                    }}
                  >
                    <TableCell
                      data-row-checkbox
                      className="w-10"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleOne(g._id)}
                        aria-label={`Select ${g.firstName} ${g.lastName}`}
                      />
                    </TableCell>
                    <TableCell className="max-w-[28ch]">
                      <div className="font-medium truncate" title={`${g.firstName} ${g.lastName}`}>
                        {g.firstName} {g.lastName}
                      </div>
                      {g.aliases.length > 0 && (
                        <div className="text-xs text-muted-foreground truncate">
                          aka {g.aliases.join(", ")}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {SIDE_LABEL[g.side]}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {g.invitationId}
                    </TableCell>
                    <TableCell>
                      <RsvpStatusBadge
                        status={g.rsvpStatus}
                        offline={g.rsvpOffline}
                      />
                    </TableCell>
                    <TableCell className="text-sm">
                      {!g.plusOneAllowed ? (
                        "—"
                      ) : g.plusOneRsvp === "yes" ? (
                        <span>
                          Yes
                          {g.plusOneName ? ` · ${g.plusOneName}` : ""}
                        </span>
                      ) : g.plusOneRsvp === "no" ? (
                        <span className="text-[var(--status-no)]">
                          Declined
                        </span>
                      ) : g.rsvpStatus === "no" ? (
                        <span className="text-muted-foreground">
                          Allowed (n/a)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <span className="size-1.5 rounded-full bg-[var(--status-offline)]" />
                          <span className="text-[var(--status-offline)]">
                            +1 pending
                          </span>
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-right text-muted-foreground">
                      {new Date(g.updatedAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

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
    </div>
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

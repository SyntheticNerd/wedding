"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/lib/convex";
import type { Doc } from "@/lib/convex";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Download } from "lucide-react";
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

  const guests = useQuery(api.guests.list, {
    side: side === "all" ? undefined : side,
    status: status === "all" ? undefined : status,
    search: search.trim() || undefined,
  }) as Doc<"guests">[] | undefined;

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
          guests.map((g) => (
            <li key={g._id}>
              <Link
                href={`/admin/guests/${g._id}`}
                className="flex items-start justify-between gap-3 p-3 active:bg-muted/50 transition-colors"
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
          ))
        )}
      </ul>

      {/* Desktop: full table */}
      <div className="hidden sm:block rounded-md border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
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
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : guests.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center py-12 text-muted-foreground"
                >
                  {search.trim() || side !== "all" || status !== "all"
                    ? "No guests match these filters."
                    : "No guests yet — add your first one."}
                </TableCell>
              </TableRow>
            ) : (
              guests.map((g) => (
                <TableRow
                  key={g._id}
                  className="cursor-pointer"
                  onClick={() => {
                    window.location.href = `/admin/guests/${g._id}`;
                  }}
                >
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
              ))
            )}
          </TableBody>
        </Table>
      </div>
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

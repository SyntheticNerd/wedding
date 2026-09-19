"use client";

import Link from "next/link";
import type { Doc, Id } from "@/lib/convex";
import { TableCell, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { RsvpStatusBadge } from "./rsvp-status-badge";
import { GuestPriorityPicker, type GuestPriority } from "./guest-priority";

export const SIDE_LABEL: Record<"bride" | "groom" | "both", string> = {
  bride: "Bride",
  groom: "Groom",
  both: "Both",
};

export type GuestRowProps = {
  guest: Doc<"guests">;
  checked: boolean;
  onToggle: (id: Id<"guests">) => void;
  onSetPriority: (id: Id<"guests">, next?: GuestPriority) => void;
  pending: boolean;
  /** In grouped view the invitation ID is shown on the group header. */
  hideInvitation?: boolean;
};

function ChildChip() {
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
      Under 6
    </span>
  );
}

/** Mobile card row — used in both the flat list and grouped households. */
export function GuestMobileRow({
  guest: g,
  checked,
  onToggle,
  onSetPriority,
  pending,
  hideInvitation,
}: GuestRowProps) {
  return (
    <li className="flex items-stretch">
      <div className="flex items-center justify-center px-4">
        <Checkbox
          checked={checked}
          onCheckedChange={() => onToggle(g._id)}
          aria-label={`Select ${g.firstName} ${g.lastName}`}
        />
      </div>
      <Link
        href={`/admin/guests/${g._id}`}
        className="flex-1 min-w-0 flex items-start gap-3 p-3 active:bg-muted/50 transition-colors"
      >
        <div className="min-w-0 flex-1">
          <div className="font-medium truncate flex items-center gap-1.5">
            <span className="truncate">
              {g.firstName} {g.lastName}
            </span>
            {g.isChild && <ChildChip />}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span>{SIDE_LABEL[g.side]}</span>
            {!hideInvitation && (
              <>
                <span aria-hidden>·</span>
                <span className="font-mono">{g.invitationId}</span>
              </>
            )}
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
      </Link>
      {/* Outside the Link so tapping these doesn't navigate. */}
      <div className="shrink-0 flex flex-col items-end justify-center gap-1.5 py-3 pr-3">
        <RsvpStatusBadge status={g.rsvpStatus} offline={g.rsvpOffline} />
        <GuestPriorityPicker
          value={g.priority}
          onChange={(next) => onSetPriority(g._id, next)}
          disabled={pending}
          ariaLabel={`Set priority for ${g.firstName} ${g.lastName}`}
        />
      </div>
    </li>
  );
}

/** Desktop table row — used in both the flat table and grouped households. */
export function GuestDesktopRow({
  guest: g,
  checked,
  onToggle,
  onSetPriority,
  pending,
  hideInvitation,
}: GuestRowProps) {
  return (
    <TableRow
      className={cn("cursor-pointer", checked && "bg-muted/40")}
      onClick={(e) => {
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
          onCheckedChange={() => onToggle(g._id)}
          aria-label={`Select ${g.firstName} ${g.lastName}`}
        />
      </TableCell>
      <TableCell className="max-w-[28ch]">
        <div
          className="font-medium truncate flex items-center gap-1.5"
          title={`${g.firstName} ${g.lastName}`}
        >
          <span className="truncate">
            {g.firstName} {g.lastName}
          </span>
          {g.isChild && <ChildChip />}
        </div>
        {g.aliases.length > 0 && (
          <div className="text-xs text-muted-foreground truncate">
            aka {g.aliases.join(", ")}
          </div>
        )}
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <GuestPriorityPicker
          value={g.priority}
          onChange={(next) => onSetPriority(g._id, next)}
          disabled={pending}
          ariaLabel={`Set priority for ${g.firstName} ${g.lastName}`}
        />
      </TableCell>
      <TableCell className="text-sm">{SIDE_LABEL[g.side]}</TableCell>
      {!hideInvitation && (
        <TableCell className="text-xs font-mono text-muted-foreground">
          {g.invitationId}
        </TableCell>
      )}
      <TableCell>
        <RsvpStatusBadge status={g.rsvpStatus} offline={g.rsvpOffline} />
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
          <span className="text-[var(--status-no)]">Declined</span>
        ) : g.rsvpStatus === "no" ? (
          <span className="text-muted-foreground">Allowed (n/a)</span>
        ) : (
          <span className="inline-flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-[var(--status-offline)]" />
            <span className="text-[var(--status-offline)]">+1 pending</span>
          </span>
        )}
      </TableCell>
      <TableCell className="text-xs text-right text-muted-foreground">
        {new Date(g.updatedAt).toLocaleDateString()}
      </TableCell>
    </TableRow>
  );
}

/** Shared household helpers. */
export function householdLabel(guests: Doc<"guests">[]): string {
  const adults = guests.filter((g) => !g.isChild);
  const primary = adults[0] ?? guests[0];
  if (!primary) return "Household";
  if (adults.length === 2 && adults[0].lastName === adults[1].lastName) {
    return `${adults[0].firstName} & ${adults[1].firstName} ${adults[0].lastName}`;
  }
  if (guests.length === 1) {
    return `${primary.firstName} ${primary.lastName}`;
  }
  return `The ${primary.lastName} household`;
}

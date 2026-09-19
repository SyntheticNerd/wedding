"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Plus, QrCode } from "lucide-react";
import type { Doc, Id } from "@/lib/convex";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { GuestMobileRow, householdLabel } from "./guest-rows";
import { GuestChildrenDialog } from "./guest-children-dialog";
import type { GuestPriority } from "./guest-priority";

type Group = {
  invitationId: string;
  label: string;
  guests: Doc<"guests">[];
  adults: number;
  children: number;
  yes: number;
  pending: number;
};

export function GuestGroups({
  guests,
  selected,
  onToggle,
  onToggleMany,
  onSetPriority,
  pending,
}: {
  guests: Doc<"guests">[];
  selected: Set<Id<"guests">>;
  onToggle: (id: Id<"guests">) => void;
  onToggleMany: (ids: Id<"guests">[], select: boolean) => void;
  onSetPriority: (id: Id<"guests">, next?: GuestPriority) => void;
  pending: boolean;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [childrenFor, setChildrenFor] = useState<Group | null>(null);

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Doc<"guests">[]>();
    for (const g of guests) {
      const arr = map.get(g.invitationId) ?? [];
      arr.push(g);
      map.set(g.invitationId, arr);
    }
    const out = Array.from(map.entries()).map(([invitationId, members]) => {
      // Adults first, then children; each alphabetized by first name.
      const sorted = [...members].sort((a, b) => {
        if (a.isChild !== b.isChild) return a.isChild ? 1 : -1;
        return a.firstName.localeCompare(b.firstName);
      });
      return {
        invitationId,
        label: householdLabel(sorted),
        guests: sorted,
        adults: sorted.filter((g) => !g.isChild).length,
        children: sorted.filter((g) => g.isChild).length,
        yes: sorted.filter((g) => g.rsvpStatus === "yes").length,
        pending: sorted.filter((g) => g.rsvpStatus === "pending").length,
      };
    });
    out.sort((a, b) => {
      const an = a.guests.find((g) => !g.isChild) ?? a.guests[0];
      const bn = b.guests.find((g) => !g.isChild) ?? b.guests[0];
      return (an?.lastName ?? "").localeCompare(bn?.lastName ?? "");
    });
    return out;
  }, [guests]);

  if (groups.length === 0) {
    return (
      <div className="rounded-md border border-border bg-card text-center py-12 text-sm text-muted-foreground">
        No guests match these filters.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {groups.map((group) => {
          const isCollapsed = collapsed.has(group.invitationId);
          const ids = group.guests.map((g) => g._id);
          const allSelected = ids.every((id) => selected.has(id));
          return (
            <div
              key={group.invitationId}
              className="rounded-lg border border-border bg-card overflow-hidden"
            >
              {/* Household header — tap the title area to collapse/expand. */}
              <div className="flex items-center gap-1 px-2 py-2 bg-muted/40 border-b border-border">
                <div
                  className="flex items-center justify-center px-2 self-stretch"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={() => onToggleMany(ids, !allSelected)}
                    aria-label={`Select everyone in ${group.label}`}
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setCollapsed((prev) => {
                      const next = new Set(prev);
                      if (next.has(group.invitationId))
                        next.delete(group.invitationId);
                      else next.add(group.invitationId);
                      return next;
                    })
                  }
                  className="flex-1 min-w-0 flex items-center gap-2 py-1.5 text-left"
                  aria-expanded={!isCollapsed}
                >
                  <ChevronDown
                    className={cn(
                      "size-4 shrink-0 text-muted-foreground transition-transform",
                      isCollapsed && "-rotate-90",
                    )}
                  />
                  <span className="min-w-0">
                    <span className="block font-medium truncate">
                      {group.label}
                    </span>
                    <span className="block text-[11px] text-muted-foreground truncate">
                      {group.adults} adult{group.adults === 1 ? "" : "s"}
                      {group.children > 0 &&
                        ` · ${group.children} child${group.children === 1 ? "" : "ren"}`}
                      {group.yes > 0 && ` · ${group.yes} going`}
                      {group.pending > 0 && ` · ${group.pending} pending`}
                    </span>
                  </span>
                </button>
                <div className="flex items-center shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setChildrenFor(group)}
                    aria-label={`Add children to ${group.label}`}
                    title="Add children"
                  >
                    <Plus className="size-4" />
                    <span className="hidden sm:inline">Children</span>
                  </Button>
                  <a
                    href={`/admin/invitations`}
                    className="inline-flex items-center justify-center size-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    aria-label={`Invitation QR for ${group.label}`}
                    title="Invitation QR codes"
                  >
                    <QrCode className="size-4" />
                  </a>
                </div>
              </div>

              {!isCollapsed && (
                <ul className="divide-y divide-border">
                  {group.guests.map((g) => (
                    <GuestMobileRow
                      key={g._id}
                      guest={g}
                      checked={selected.has(g._id)}
                      onToggle={onToggle}
                      onSetPriority={onSetPriority}
                      pending={pending}
                      hideInvitation
                    />
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {childrenFor && (
        <GuestChildrenDialog
          invitationId={childrenFor.invitationId}
          householdLabel={childrenFor.label}
          defaultLastName={
            (childrenFor.guests.find((g) => !g.isChild) ?? childrenFor.guests[0])
              ?.lastName
          }
          open={childrenFor !== null}
          onOpenChange={(o) => !o && setChildrenFor(null)}
        />
      )}
    </>
  );
}

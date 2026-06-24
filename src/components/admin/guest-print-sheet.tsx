"use client";

/**
 * GuestPrintSheet — a print-only, formatted guest roster grouped by household.
 *
 * Hidden on screen (`hidden print:block`); the rest of the guest-list UI is
 * `print:hidden`, so window.print() yields a clean document. Reflects whatever
 * filtered set the table is currently showing.
 */

import type { Doc } from "@/lib/convex";
import {
  GuestPriorityBadge,
  PriorityDot,
  priorityMeta,
  type GuestPriority,
} from "./guest-priority";

const SIDE_LABEL: Record<Doc<"guests">["side"], string> = {
  bride: "Bride",
  groom: "Groom",
  both: "Both",
};

function rsvpLabel(g: Doc<"guests">): string {
  const base =
    g.rsvpStatus === "yes" ? "Yes" : g.rsvpStatus === "no" ? "No" : "Pending";
  return g.rsvpOffline ? `${base} (offline)` : base;
}

function plusOneLabel(g: Doc<"guests">): string | null {
  if (!g.plusOneAllowed) return null;
  if (g.plusOneRsvp === "yes") {
    return g.plusOneName ? `+1: ${g.plusOneName}` : "+1: yes";
  }
  if (g.plusOneRsvp === "no") return "+1: declined";
  return "+1: allowed";
}

interface Household {
  invitationId: string;
  members: Doc<"guests">[];
}

function groupByHousehold(guests: Doc<"guests">[]): Household[] {
  const map = new Map<string, Household>();
  for (const g of guests) {
    const entry = map.get(g.invitationId) ?? {
      invitationId: g.invitationId,
      members: [],
    };
    entry.members.push(g);
    map.set(g.invitationId, entry);
  }
  const households = Array.from(map.values()).map((h) => ({
    ...h,
    members: [...h.members].sort((a, b) =>
      a.firstName.localeCompare(b.firstName),
    ),
  }));
  households.sort((a, b) =>
    (a.members[0]?.lastName ?? "").localeCompare(b.members[0]?.lastName ?? ""),
  );
  return households;
}

/** One-line summary of priority counts for the header. */
function prioritySummary(guests: Doc<"guests">[]): string {
  const count = (p: GuestPriority) =>
    guests.filter((g) => g.priority === p).length;
  const parts: string[] = [];
  const must = count("must_have");
  const kind = count("kind_of");
  const obl = count("obligated");
  if (must) parts.push(`${must} ${priorityMeta("must_have").label}`);
  if (kind) parts.push(`${kind} ${priorityMeta("kind_of").label}`);
  if (obl) parts.push(`${obl} ${priorityMeta("obligated").label}`);
  return parts.join(" · ");
}

export function GuestPrintSheet({
  guests,
  filterLabel,
  printedOn,
}: {
  guests: Doc<"guests">[];
  /** Short description of the active filter, e.g. "Groom · Must-have". */
  filterLabel?: string;
  /** Pre-formatted date string (built by the caller to avoid hydration drift). */
  printedOn: string;
}) {
  const households = groupByHousehold(guests);
  const prioCounts = prioritySummary(guests);

  return (
    <div
      data-testid="guest-print-sheet"
      className="hidden text-black print:block [print-color-adjust:exact] [-webkit-print-color-adjust:exact]"
    >
      <header className="mb-4 border-b-2 border-black pb-2">
        <h1 className="text-2xl font-semibold">Guest List</h1>
        <p className="mt-1 text-sm">
          {guests.length} {guests.length === 1 ? "guest" : "guests"} ·{" "}
          {households.length}{" "}
          {households.length === 1 ? "household" : "households"}
          {filterLabel ? ` · ${filterLabel}` : ""} · {printedOn}
        </p>
        {prioCounts && <p className="mt-0.5 text-xs">{prioCounts}</p>}
      </header>

      {households.length === 0 ? (
        <p className="text-sm">No guests match the current filters.</p>
      ) : (
        <div className="space-y-3">
          {households.map((h) => (
            <section
              key={h.invitationId}
              className="break-inside-avoid border-b border-black/25 pb-2"
            >
              <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-black/60">
                {h.invitationId}
              </div>
              <ul className="space-y-1">
                {h.members.map((g) => (
                  <li
                    key={g._id}
                    className="flex items-baseline gap-2 text-sm"
                  >
                    {g.priority ? (
                      <PriorityDot
                        priority={g.priority}
                        className="translate-y-[1px]"
                      />
                    ) : (
                      <span className="inline-block w-2.5" aria-hidden />
                    )}
                    <span className="min-w-[14rem] font-medium">
                      {g.firstName} {g.lastName}
                    </span>
                    <span className="w-14 text-xs text-black/70">
                      {SIDE_LABEL[g.side]}
                    </span>
                    <span className="w-24 text-xs text-black/70">
                      {rsvpLabel(g)}
                    </span>
                    {plusOneLabel(g) && (
                      <span className="text-xs text-black/70">
                        {plusOneLabel(g)}
                      </span>
                    )}
                    <span className="ml-auto">
                      <GuestPriorityBadge priority={g.priority} />
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

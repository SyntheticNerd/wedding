"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api, type Id } from "@/lib/convex";
import { RsvpStatusBadge } from "./rsvp-status-badge";

type Group = {
  invitationId: string;
  guests: Array<{
    id: Id<"guests">;
    firstName: string;
    lastName: string;
    rsvpStatus: "pending" | "yes" | "no";
    hasPhone: boolean;
  }>;
};

export function InvitationsView() {
  const groups = useQuery(api.guests.listInvitations, {});
  // Read origin lazily — the component is a client component so window is
  // available at mount time.
  const [origin] = useState<string>(() =>
    typeof window !== "undefined" ? window.location.origin : "",
  );

  if (groups === undefined) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-72" />
        ))}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        No invitations yet — add some guests on the{" "}
        <a href="/admin" className="underline">
          guest list
        </a>
        .
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4 print:hidden">
        <p className="text-sm text-muted-foreground">
          {groups.length} household{groups.length === 1 ? "" : "s"} ·{" "}
          {groups.reduce((acc, g) => acc + g.guests.length, 0)} guests
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => window.print()}
        >
          Print all
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 print:gap-0 print:grid-cols-2">
        {groups.map((g) => (
          <InvitationCard key={g.invitationId} group={g} origin={origin} />
        ))}
      </div>
    </>
  );
}

function InvitationCard({ group, origin }: { group: Group; origin: string }) {
  const url = origin
    ? `${origin}/rsvp?invitation=${encodeURIComponent(group.invitationId)}`
    : "";
  const householdLabel =
    group.guests.length === 1
      ? `${group.guests[0].firstName} ${group.guests[0].lastName}`
      : group.guests.length === 2 &&
          group.guests[0].lastName === group.guests[1].lastName
        ? `${group.guests[0].firstName} & ${group.guests[1].firstName} ${group.guests[0].lastName}`
        : `The ${group.guests[0].lastName} household`;

  function copyLink() {
    if (!url) return;
    navigator.clipboard
      .writeText(url)
      .then(() => toast.success("Link copied"))
      .catch(() => toast.error("Couldn't copy"));
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col break-inside-avoid print:border-charcoal/30 print:rounded-none print:shadow-none">
      <div className="flex flex-col items-center text-center">
        <div className="bg-white p-3 rounded-md border border-border">
          {url ? (
            <QRCodeSVG value={url} size={140} level="M" />
          ) : (
            <div className="size-[140px] bg-muted animate-pulse rounded" />
          )}
        </div>
        <p className="font-heading text-xl mt-4">{householdLabel}</p>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
          {group.invitationId}
        </p>
      </div>
      <ul className="mt-4 space-y-1.5 text-sm flex-1">
        {group.guests.map((guest) => (
          <li
            key={guest.id}
            className="flex items-center justify-between gap-2"
          >
            <a
              href={`/admin/guests/${guest.id}`}
              className="hover:underline truncate"
            >
              {guest.firstName} {guest.lastName}
              {!guest.hasPhone && (
                <span className="ml-1.5 text-[10px] text-muted-foreground uppercase tracking-widest">
                  no phone
                </span>
              )}
            </a>
            <RsvpStatusBadge status={guest.rsvpStatus} />
          </li>
        ))}
      </ul>
      <div className="mt-4 flex gap-2 print:hidden">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={copyLink}
          className="flex-1"
        >
          Copy link
        </Button>
        <a
          href={url || "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-foreground self-center"
        >
          Preview ↗
        </a>
      </div>
    </div>
  );
}

"use client";

import { use } from "react";
import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "@/lib/convex";
import type { Id } from "@/lib/convex";
import { GuestForm } from "@/components/admin/guest-form";
import { Skeleton } from "@/components/ui/skeleton";

export default function GuestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const guestId = id as Id<"guests">;
  const guest = useQuery(api.guests.get, { id: guestId });

  if (guest === undefined) {
    return (
      <div className="space-y-4 max-w-3xl">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (guest === null) {
    return (
      <div className="space-y-4">
        <Link href="/admin" className="text-sm text-muted-foreground">
          ← Back
        </Link>
        <p>Guest not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link
          href="/admin"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to guest list
        </Link>
        <h1 className="font-heading text-3xl mt-2">
          {guest.firstName} {guest.lastName}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Invitation <span className="font-mono">{guest.invitationId}</span>
        </p>
      </div>
      <GuestForm mode="edit" initial={guest} />
    </div>
  );
}

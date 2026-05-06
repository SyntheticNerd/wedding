"use client";

import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { Skeleton } from "@/components/ui/skeleton";
import { EnsureAdminProfile } from "./ensure-admin-profile";

/**
 * Client-side gate around admin children.
 *
 * Server-side `auth()` in the layout confirms the Clerk session before we
 * even render. But the Convex client takes a beat after mount to receive
 * the JWT from Clerk and complete its auth handshake. During that window,
 * any `useQuery` call fires unauthenticated and the server returns
 * "Not authenticated".
 *
 * `<Authenticated>` from `convex/react` only renders children once Convex
 * itself sees an authenticated session. Queries can run safely inside.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AuthLoading>
        <div className="space-y-4">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-96" />
        </div>
      </AuthLoading>
      <Authenticated>
        <EnsureAdminProfile />
        {children}
      </Authenticated>
      <Unauthenticated>
        <p className="text-sm text-muted-foreground">
          Session expired — please sign in again.
        </p>
      </Unauthenticated>
    </>
  );
}

"use client";

import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useAuth } from "@clerk/nextjs";
import type { ReactNode } from "react";

const url = process.env.NEXT_PUBLIC_CONVEX_URL;
const convex = url
  ? new ConvexReactClient(url, { unsavedChangesWarning: false })
  : null;

export function ConvexClerkProvider({ children }: { children: ReactNode }) {
  // Build-time guard: when the env var hasn't been set yet (first deploy
  // before Convex is wired up), let pages render without the provider so
  // the build succeeds. Components that call useQuery will be in admin
  // routes which are dynamic — by the time those run, the env var will be
  // present in production.
  if (!convex) {
    return <>{children}</>;
  }
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}

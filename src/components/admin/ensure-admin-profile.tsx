"use client";

import { useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@/lib/convex";

/**
 * Lazy-creates an `adminProfiles` row for the signed-in admin if one
 * doesn't exist yet. Mounted once at admin layout level.
 */
export function EnsureAdminProfile() {
  const ensure = useMutation(api.adminProfiles.ensureProfile);
  useEffect(() => {
    ensure({}).catch(() => {
      /* noop — page will still render */
    });
  }, [ensure]);
  return null;
}

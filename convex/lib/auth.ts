import type { QueryCtx, MutationCtx, ActionCtx } from "../_generated/server";

/**
 * Throws if the caller is not authenticated. Returns the Clerk user identity.
 *
 * Allowlisting of which Clerk users may act as admins is enforced in Clerk's
 * dashboard (Restrictions → Allowlist), so any signed-in user reaching the
 * Convex layer is already trusted. We still surface the userId for audit.
 */
export async function requireAdmin(
  ctx: QueryCtx | MutationCtx | ActionCtx,
): Promise<{ userId: string; email: string | undefined }> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }
  return {
    userId: identity.subject,
    email: identity.email ?? undefined,
  };
}

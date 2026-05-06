/**
 * Companion to convex/notifications.ts. Internal queries live here because
 * the Resend action is `"use node"` — that file can only export actions.
 */
import { v } from "convex/values";
import { internalQuery } from "./_generated/server";

export const loadNotificationContext = internalQuery({
  args: { guestId: v.id("guests") },
  handler: async (ctx, args) => {
    const guest = await ctx.db.get(args.guestId);
    if (!guest) return null;
    const admins = await ctx.db.query("adminProfiles").collect();
    const recipients = admins
      .filter((a) => a.emailNotificationsEnabled && a.email)
      .map((a) => ({
        email: a.email!,
        displayName: a.displayName,
      }));
    return { guest, recipients };
  },
});

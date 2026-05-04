import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/auth";

export const me = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const profile = await ctx.db
      .query("adminProfiles")
      .withIndex("by_clerk_user", (q) =>
        q.eq("clerkUserId", identity.subject),
      )
      .first();
    return {
      identity,
      profile,
    };
  },
});

export const ensureProfile = mutation({
  args: { displayName: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const existing = await ctx.db
      .query("adminProfiles")
      .withIndex("by_clerk_user", (q) =>
        q.eq("clerkUserId", identity.subject),
      )
      .first();
    if (existing) return existing._id;
    const id = await ctx.db.insert("adminProfiles", {
      clerkUserId: identity.subject,
      displayName:
        args.displayName ??
        identity.name ??
        identity.email ??
        "Admin",
      emailNotificationsEnabled: true,
    });
    return id;
  },
});

export const setNotificationsEnabled = mutation({
  args: { enabled: v.boolean() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const profile = await ctx.db
      .query("adminProfiles")
      .withIndex("by_clerk_user", (q) =>
        q.eq("clerkUserId", identity.subject),
      )
      .first();
    if (!profile) throw new Error("Profile not found — call ensureProfile first");
    await ctx.db.patch(profile._id, {
      emailNotificationsEnabled: args.enabled,
    });
  },
});

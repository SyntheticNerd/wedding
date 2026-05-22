import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/auth";

export const get = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const row = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    return row?.value ?? null;
  },
});

export const set = mutation({
  args: { key: v.string(), value: v.any() },
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.value,
        updatedAt: now,
        updatedBy: userId,
      });
    } else {
      await ctx.db.insert("settings", {
        key: args.key,
        value: args.value,
        updatedAt: now,
        updatedBy: userId,
      });
    }
  },
});

export const all = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("settings").collect();
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  },
});

/**
 * Public-readable subset of settings for use on unauthenticated pages
 * (e.g. /rsvp). Only exposes keys that are safe to surface to guests.
 */
const PUBLIC_KEYS = new Set([
  "lockedAt",
  "weddingDate",
  "coupleNames",
  "venueName",
  "venueLocation",
  "honeymoonFund.headline",
  "honeymoonFund.blurb",
  "honeymoonFund.ctaUrl",
  "honeymoonFund.ctaLabel",
  "honeymoonFund.enabled",
]);

export const publicSettings = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("settings").collect();
    const out: Record<string, unknown> = {};
    for (const r of rows) {
      if (PUBLIC_KEYS.has(r.key)) out[r.key] = r.value;
    }
    return out;
  },
});

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { type Doc, type Id } from "./_generated/dataModel";
import { requireAdmin } from "./lib/auth";

const STATUS = v.union(
  v.literal("scheduled"),
  v.literal("completed"),
  v.literal("cancelled"),
);

/* ----------------------------------------------------------------------
   Queries
   -------------------------------------------------------------------- */

/** All non-deleted appointments for a vendor, ascending by startAt. */
export const listByVendor = query({
  args: { vendorId: v.id("vendors") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const vendorId = args.vendorId;
    const rows = await ctx.db
      .query("vendorAppointments")
      .withIndex("by_vendor", (q) =>
        q.eq("vendorId", vendorId).eq("deletedAt", undefined),
      )
      .collect();
    return rows.sort((a, b) => a.startAt - b.startAt);
  },
});

export const get = query({
  args: { id: v.id("vendorAppointments") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db.get(args.id);
  },
});

/* ----------------------------------------------------------------------
   Mutations
   -------------------------------------------------------------------- */

const appointmentFields = {
  vendorId: v.id("vendors"),
  startAt: v.number(),
  endAt: v.number(),
  location: v.optional(v.string()),
  notes: v.optional(v.string()),
  status: v.optional(STATUS),
};

export const add = mutation({
  args: appointmentFields,
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);
    if (args.endAt < args.startAt) {
      throw new Error("End time must be at or after start time");
    }
    const now = Date.now();
    const id = await ctx.db.insert("vendorAppointments", {
      vendorId: args.vendorId,
      startAt: args.startAt,
      endAt: args.endAt,
      location: args.location?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
      status: args.status ?? "scheduled",
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
    });
    return { id };
  },
});

export const update = mutation({
  args: { id: v.id("vendorAppointments"), ...appointmentFields },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Appointment not found");
    if (args.endAt < args.startAt) {
      throw new Error("End time must be at or after start time");
    }
    await ctx.db.patch(args.id, {
      vendorId: args.vendorId,
      startAt: args.startAt,
      endAt: args.endAt,
      location: args.location?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
      status: args.status ?? existing.status,
      updatedAt: Date.now(),
    });
    return args.id;
  },
});

export const setStatus = mutation({
  args: { id: v.id("vendorAppointments"), status: STATUS },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Appointment not found");
    await ctx.db.patch(args.id, {
      status: args.status,
      updatedAt: Date.now(),
    });
  },
});

export const softDelete = mutation({
  args: { id: v.id("vendorAppointments") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Appointment not found");
    await ctx.db.patch(args.id, {
      deletedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

/* ----------------------------------------------------------------------
   Cross-vendor query for the admin landing page
   -------------------------------------------------------------------- */

/**
 * Next N scheduled appointments across all vendors. Joins vendor names so
 * the caller doesn't need a second hop. Used by /admin landing.
 */
export const listUpcomingAll = query({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const now = Date.now();
    const rows = await ctx.db
      .query("vendorAppointments")
      .withIndex("by_start_status", (q) =>
        q
          .eq("deletedAt", undefined)
          .eq("status", "scheduled")
          .gte("startAt", now),
      )
      .order("asc")
      .take(args.limit);

    const vendorIds = Array.from(new Set(rows.map((r) => r.vendorId)));
    const vendorMap = new Map<string, string>();
    for (const vid of vendorIds) {
      const v = await ctx.db.get(vid);
      if (v) vendorMap.set(vid, v.name);
    }
    return rows.map((r) => ({
      ...r,
      vendorName: vendorMap.get(r.vendorId) ?? "(unknown vendor)",
    }));
  },
});

export type Appointment = Doc<"vendorAppointments">;
export type AppointmentId = Id<"vendorAppointments">;

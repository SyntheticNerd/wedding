import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { type Doc, type Id } from "./_generated/dataModel";
import { requireAdmin } from "./lib/auth";

/* ----------------------------------------------------------------------
   Queries
   -------------------------------------------------------------------- */

/** Admin list: every non-deleted registry, ordered by displayOrder. */
export const listAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("registries").collect();
    return rows
      .filter((r) => r.deletedAt === undefined)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  },
});

/** Public list: only non-deleted, non-hidden, ordered by displayOrder. */
export const listPublic = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("registries").collect();
    return rows
      .filter((r) => r.deletedAt === undefined && !r.hidden)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  },
});

export const get = query({
  args: { id: v.id("registries") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db.get(args.id);
  },
});

/* ----------------------------------------------------------------------
   Mutations
   -------------------------------------------------------------------- */

const registryFields = {
  name: v.string(),
  url: v.string(),
  logoUrl: v.optional(v.string()),
  blurb: v.optional(v.string()),
  hidden: v.optional(v.boolean()),
};

export const add = mutation({
  args: registryFields,
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);
    const now = Date.now();

    // Append to the end: max(displayOrder) + 10, leaving sparse gaps so
    // future drag-reorders rarely need a full renumber.
    const existing = await ctx.db.query("registries").collect();
    const maxOrder = existing.reduce(
      (m, r) => (r.displayOrder > m ? r.displayOrder : m),
      0,
    );

    const id = await ctx.db.insert("registries", {
      name: args.name.trim(),
      url: args.url.trim(),
      logoUrl: args.logoUrl?.trim() || undefined,
      blurb: args.blurb?.trim() || undefined,
      displayOrder: maxOrder + 10,
      hidden: args.hidden ?? false,
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
    });
    return { id };
  },
});

export const update = mutation({
  args: { id: v.id("registries"), ...registryFields },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Registry not found");
    await ctx.db.patch(args.id, {
      name: args.name.trim(),
      url: args.url.trim(),
      logoUrl: args.logoUrl?.trim() || undefined,
      blurb: args.blurb?.trim() || undefined,
      hidden: args.hidden ?? existing.hidden,
      updatedAt: Date.now(),
    });
    return args.id;
  },
});

export const setHidden = mutation({
  args: { id: v.id("registries"), hidden: v.boolean() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Registry not found");
    await ctx.db.patch(args.id, {
      hidden: args.hidden,
      updatedAt: Date.now(),
    });
  },
});

export const softDelete = mutation({
  args: { id: v.id("registries") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Registry not found");
    await ctx.db.patch(args.id, {
      deletedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const restore = mutation({
  args: { id: v.id("registries") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Registry not found");
    await ctx.db.patch(args.id, {
      deletedAt: undefined,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Reorder registries by passing the desired sequence of IDs.
 * Renumbers all rows to displayOrder = 10, 20, 30, ... in the given order.
 * IDs not included are pushed to the end in their previous relative order.
 */
export const reorder = mutation({
  args: { orderedIds: v.array(v.id("registries")) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const rows = (await ctx.db.query("registries").collect()).filter(
      (r) => r.deletedAt === undefined,
    );
    const byId = new Map<Id<"registries">, Doc<"registries">>(
      rows.map((r) => [r._id, r]),
    );
    const seen = new Set<Id<"registries">>();
    const ordered: Doc<"registries">[] = [];

    for (const id of args.orderedIds) {
      const row = byId.get(id);
      if (row) {
        ordered.push(row);
        seen.add(id);
      }
    }
    // Anything not in orderedIds keeps its prior relative order and goes last.
    const remainder = rows
      .filter((r) => !seen.has(r._id))
      .sort((a, b) => a.displayOrder - b.displayOrder);
    const final = [...ordered, ...remainder];

    const now = Date.now();
    for (let i = 0; i < final.length; i++) {
      const newOrder = (i + 1) * 10;
      if (final[i].displayOrder !== newOrder) {
        await ctx.db.patch(final[i]._id, {
          displayOrder: newOrder,
          updatedAt: now,
        });
      }
    }
  },
});

export type Registry = Doc<"registries">;
export type RegistryId = Id<"registries">;

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { type Doc, type Id } from "./_generated/dataModel";
import { requireAdmin } from "./lib/auth";

/* ----------------------------------------------------------------------
   Queries (admin)
   -------------------------------------------------------------------- */

export const listAdmin = query({
  args: {
    registryId: v.optional(v.id("registries")),
    hidden: v.optional(v.boolean()),
    claimed: v.optional(v.boolean()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const search = args.search?.trim();

    let rows: Doc<"registryProducts">[];
    if (search) {
      rows = await ctx.db
        .query("registryProducts")
        .withSearchIndex("search_name", (q) => {
          let qb = q.search("name", search);
          if (args.registryId) qb = qb.eq("registryId", args.registryId);
          if (args.hidden !== undefined) qb = qb.eq("hidden", args.hidden);
          qb = qb.eq("deletedAt", undefined);
          return qb;
        })
        .collect();
    } else if (args.registryId) {
      const rid = args.registryId;
      rows = await ctx.db
        .query("registryProducts")
        .withIndex("by_registry", (q) =>
          q.eq("registryId", rid).eq("deletedAt", undefined),
        )
        .collect();
    } else {
      rows = await ctx.db.query("registryProducts").collect();
    }

    return rows
      .filter((p) => p.deletedAt === undefined)
      .filter((p) => (args.hidden === undefined ? true : p.hidden === args.hidden))
      .filter((p) => {
        if (args.claimed === undefined) return true;
        const isClaimed = p.claimedAt !== undefined;
        return isClaimed === args.claimed;
      })
      .sort((a, b) => a.displayOrder - b.displayOrder);
  },
});

export const countsByRegistry = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = (await ctx.db.query("registryProducts").collect()).filter(
      (p) => p.deletedAt === undefined,
    );
    const counts = new Map<string, number>();
    for (const r of rows) {
      counts.set(r.registryId, (counts.get(r.registryId) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([registryId, count]) => ({
      registryId,
      count,
    }));
  },
});

export const get = query({
  args: { id: v.id("registryProducts") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db.get(args.id);
  },
});

/* ----------------------------------------------------------------------
   Mutations
   -------------------------------------------------------------------- */

const productFields = {
  registryId: v.id("registries"),
  name: v.string(),
  priceCents: v.number(),
  imageUrl: v.string(),
  productUrl: v.string(),
  hidden: v.optional(v.boolean()),
};

export const add = mutation({
  args: {
    ...productFields,
    // Optional OG snapshot, written when called from the fetch flow.
    ogTitle: v.optional(v.string()),
    ogImageUrl: v.optional(v.string()),
    ogFetchedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);
    const now = Date.now();

    const existing = await ctx.db.query("registryProducts").collect();
    const maxOrder = existing.reduce(
      (m, r) => (r.displayOrder > m ? r.displayOrder : m),
      0,
    );

    const id = await ctx.db.insert("registryProducts", {
      registryId: args.registryId,
      name: args.name.trim(),
      priceCents: Math.max(0, Math.round(args.priceCents)),
      imageUrl: args.imageUrl.trim(),
      productUrl: args.productUrl.trim(),
      displayOrder: maxOrder + 10,
      hidden: args.hidden ?? false,
      ogTitle: args.ogTitle,
      ogImageUrl: args.ogImageUrl,
      ogFetchedAt: args.ogFetchedAt,
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
    });
    return { id };
  },
});

export const update = mutation({
  args: { id: v.id("registryProducts"), ...productFields },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Product not found");
    await ctx.db.patch(args.id, {
      registryId: args.registryId,
      name: args.name.trim(),
      priceCents: Math.max(0, Math.round(args.priceCents)),
      imageUrl: args.imageUrl.trim(),
      productUrl: args.productUrl.trim(),
      hidden: args.hidden ?? existing.hidden,
      updatedAt: Date.now(),
    });
    return args.id;
  },
});

export const setHidden = mutation({
  args: { id: v.id("registryProducts"), hidden: v.boolean() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Product not found");
    await ctx.db.patch(args.id, { hidden: args.hidden, updatedAt: Date.now() });
  },
});

export const setClaimed = mutation({
  args: { id: v.id("registryProducts"), claimed: v.boolean() },
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Product not found");
    await ctx.db.patch(args.id, {
      claimedAt: args.claimed ? Date.now() : undefined,
      claimedBy: args.claimed ? userId : undefined,
      updatedAt: Date.now(),
    });
  },
});

export const softDelete = mutation({
  args: { id: v.id("registryProducts") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Product not found");
    await ctx.db.patch(args.id, {
      deletedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const reorder = mutation({
  args: { orderedIds: v.array(v.id("registryProducts")) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const rows = (await ctx.db.query("registryProducts").collect()).filter(
      (p) => p.deletedAt === undefined,
    );
    const byId = new Map<Id<"registryProducts">, Doc<"registryProducts">>(
      rows.map((r) => [r._id, r]),
    );
    const seen = new Set<Id<"registryProducts">>();
    const ordered: Doc<"registryProducts">[] = [];

    for (const id of args.orderedIds) {
      const row = byId.get(id);
      if (row) {
        ordered.push(row);
        seen.add(id);
      }
    }
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

/**
 * Apply an OG snapshot returned by `fetchOg` to a product, but only
 * overwrite the snapshot fields (ogTitle, ogImageUrl, ogFetchedAt).
 * Admin's name / imageUrl / priceCents are untouched.
 */
export const applyOgSnapshot = mutation({
  args: {
    id: v.id("registryProducts"),
    ogTitle: v.optional(v.string()),
    ogImageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Product not found");
    await ctx.db.patch(args.id, {
      ogTitle: args.ogTitle,
      ogImageUrl: args.ogImageUrl,
      ogFetchedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export type RegistryProduct = Doc<"registryProducts">;
export type RegistryProductId = Id<"registryProducts">;

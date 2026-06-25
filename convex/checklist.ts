import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { type Doc, type Id } from "./_generated/dataModel";
import { requireAdmin } from "./lib/auth";
import { CHECKLIST_DEFAULTS } from "./lib/checklistDefaults";

/* ----------------------------------------------------------------------
   Queries
   -------------------------------------------------------------------- */

type VendorLink = {
  /** Most-advanced vendor status found in this item's category. */
  status: "chosen" | "considering" | "none";
  chosenId?: Id<"vendors">;
  chosenName?: string;
  consideringCount: number;
};

/**
 * All checklist items in display order, each enriched with a `vendor` summary
 * derived from the vendor list when the item has a category. This is the tie
 * to the vendor board: the UI shows whether the category is already locked in
 * and links straight to the chosen vendor / filtered list.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const items = await ctx.db
      .query("checklistItems")
      .withIndex("by_order", (q) => q.eq("deletedAt", undefined))
      .collect();

    const vendors = (await ctx.db.query("vendors").collect()).filter(
      (vRow) => vRow.deletedAt === undefined,
    );

    const byCategory = new Map<
      string,
      { chosen: Doc<"vendors">[]; considering: Doc<"vendors">[] }
    >();
    for (const vRow of vendors) {
      const entry = byCategory.get(vRow.category) ?? {
        chosen: [],
        considering: [],
      };
      if (vRow.status === "chosen") entry.chosen.push(vRow);
      else if (vRow.status === "considering") entry.considering.push(vRow);
      byCategory.set(vRow.category, entry);
    }

    return items.map((item) => {
      let vendor: VendorLink | null = null;
      if (item.category) {
        const entry = byCategory.get(item.category);
        if (!entry || (entry.chosen.length === 0 && entry.considering.length === 0)) {
          vendor = { status: "none", consideringCount: 0 };
        } else if (entry.chosen.length > 0) {
          vendor = {
            status: "chosen",
            chosenId: entry.chosen[0]._id,
            chosenName: entry.chosen[0].name,
            consideringCount: entry.considering.length,
          };
        } else {
          vendor = {
            status: "considering",
            consideringCount: entry.considering.length,
          };
        }
      }
      return { ...item, vendor };
    });
  },
});

/* ----------------------------------------------------------------------
   Mutations
   -------------------------------------------------------------------- */

export const add = mutation({
  args: {
    title: v.string(),
    section: v.optional(v.string()),
    category: v.optional(v.string()),
    notes: v.optional(v.string()),
    dueAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);
    const title = args.title.trim();
    if (!title) throw new Error("Title is required");
    const now = Date.now();
    // Largest existing order + 1, so new items land at the bottom.
    const last = await ctx.db
      .query("checklistItems")
      .withIndex("by_order", (q) => q.eq("deletedAt", undefined))
      .order("desc")
      .first();
    const displayOrder = (last?.displayOrder ?? 0) + 1;
    const id = await ctx.db.insert("checklistItems", {
      title,
      section: args.section?.trim() || "General",
      category: args.category?.trim() || undefined,
      done: false,
      notes: args.notes?.trim() || undefined,
      dueAt: args.dueAt,
      displayOrder,
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
    });
    return { id };
  },
});

export const update = mutation({
  args: {
    id: v.id("checklistItems"),
    title: v.string(),
    section: v.optional(v.string()),
    category: v.optional(v.string()),
    notes: v.optional(v.string()),
    dueAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Item not found");
    const title = args.title.trim();
    if (!title) throw new Error("Title is required");
    await ctx.db.patch(args.id, {
      title,
      section: args.section?.trim() || "General",
      category: args.category?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
      dueAt: args.dueAt,
      updatedAt: Date.now(),
    });
    return args.id;
  },
});

export const setDone = mutation({
  args: { id: v.id("checklistItems"), done: v.boolean() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Item not found");
    const now = Date.now();
    await ctx.db.patch(args.id, {
      done: args.done,
      doneAt: args.done ? now : undefined,
      updatedAt: now,
    });
  },
});

export const remove = mutation({
  args: { id: v.id("checklistItems") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Item not found");
    const now = Date.now();
    await ctx.db.patch(args.id, { deletedAt: now, updatedAt: now });
  },
});

/**
 * Populate the starter checklist. Idempotent: does nothing if any non-deleted
 * item already exists, so it's safe to wire to a one-click button.
 */
export const seedDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAdmin(ctx);
    const existing = await ctx.db
      .query("checklistItems")
      .withIndex("by_order", (q) => q.eq("deletedAt", undefined))
      .first();
    if (existing) return { inserted: 0, skipped: true as const };

    const now = Date.now();
    let order = 0;
    for (const item of CHECKLIST_DEFAULTS) {
      order += 1;
      await ctx.db.insert("checklistItems", {
        title: item.title,
        section: item.section,
        category: item.category,
        done: false,
        displayOrder: order,
        createdAt: now,
        createdBy: userId,
        updatedAt: now,
      });
    }
    return { inserted: CHECKLIST_DEFAULTS.length, skipped: false as const };
  },
});

export type ChecklistItem = Doc<"checklistItems">;
export type ChecklistItemId = Id<"checklistItems">;

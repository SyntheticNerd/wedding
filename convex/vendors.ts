import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { type Doc, type Id } from "./_generated/dataModel";
import { requireAdmin } from "./lib/auth";

const VENDOR_STATUS = v.union(
  v.literal("considering"),
  v.literal("chosen"),
  v.literal("passed"),
);

const PRICE_UNIT = v.union(
  v.literal("flat"),
  v.literal("per_head"),
  v.literal("per_hour"),
);

const LINK = v.object({
  label: v.string(),
  url: v.string(),
});

/* ----------------------------------------------------------------------
   Queries
   -------------------------------------------------------------------- */

export const list = query({
  args: {
    category: v.optional(v.string()),
    status: v.optional(VENDOR_STATUS),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const all = await ctx.db.query("vendors").collect();
    const search = args.search?.trim().toLowerCase();
    return all
      .filter((vRow) => vRow.deletedAt === undefined)
      .filter((vRow) =>
        args.category ? vRow.category === args.category : true,
      )
      .filter((vRow) => (args.status ? vRow.status === args.status : true))
      .filter((vRow) => {
        if (!search) return true;
        const hay = [
          vRow.name,
          vRow.location ?? "",
          vRow.contactName ?? "",
          vRow.notes ?? "",
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(search);
      })
      .sort((a, b) => {
        const byCat = a.category.localeCompare(b.category);
        if (byCat !== 0) return byCat;
        return a.name.localeCompare(b.name);
      });
  },
});

export const get = query({
  args: { id: v.id("vendors") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db.get(args.id);
  },
});

/**
 * Aggregate dollars across vendors for the BudgetBar.
 *
 * Per-head pricing is multiplied by the current confirmed-RSVP count read
 * from the guests table. Per-hour quotes can't be auto-resolved (we don't
 * know how many hours), so they contribute their face value as a best-guess
 * lower bound; the UI labels them with their unit in the row.
 *
 * Returns dollars (integers). Soft-deleted vendors are excluded.
 */
export const rollups = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const vendorRows = (await ctx.db.query("vendors").collect()).filter(
      (vRow) => vRow.deletedAt === undefined,
    );

    const guests = await ctx.db
      .query("guests")
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();
    const confirmedHeadcount = guests.reduce((n, g) => {
      let add = g.rsvpStatus === "yes" ? 1 : 0;
      if (g.plusOneAllowed && g.plusOneRsvp === "yes") add += 1;
      return n + add;
    }, 0);

    function resolvePrice(vRow: Doc<"vendors">): number {
      if (vRow.priceTotal == null) return 0;
      if (vRow.priceUnit === "per_head") {
        return vRow.priceTotal * confirmedHeadcount;
      }
      return vRow.priceTotal;
    }

    const chosen = vendorRows.filter((vRow) => vRow.status === "chosen");
    const considering = vendorRows.filter(
      (vRow) => vRow.status === "considering",
    );

    const committed = chosen.reduce((n, vRow) => n + resolvePrice(vRow), 0);
    const consideringTotal = considering.reduce(
      (n, vRow) => n + resolvePrice(vRow),
      0,
    );

    const depositsPaid = chosen.reduce(
      (n, vRow) =>
        n + (vRow.depositPaidAt != null ? (vRow.depositAmount ?? 0) : 0),
      0,
    );
    const outstanding = Math.max(0, committed - depositsPaid);

    const horizon = Date.now() + 30 * 24 * 60 * 60 * 1000;
    const upcoming30d = chosen
      .filter(
        (vRow) =>
          vRow.finalDueAt != null &&
          vRow.finalPaidAt == null &&
          vRow.finalDueAt <= horizon,
      )
      .map((vRow) => ({
        id: vRow._id,
        name: vRow.name,
        dueAt: vRow.finalDueAt as number,
        amount: Math.max(
          0,
          resolvePrice(vRow) -
            (vRow.depositPaidAt != null ? (vRow.depositAmount ?? 0) : 0),
        ),
      }))
      .sort((a, b) => a.dueAt - b.dueAt);

    return {
      chosenCount: chosen.length,
      consideringCount: considering.length,
      committed,
      consideringTotal,
      depositsPaid,
      outstanding,
      confirmedHeadcount,
      upcoming30d,
    };
  },
});

/* ----------------------------------------------------------------------
   Mutations
   -------------------------------------------------------------------- */

const vendorFields = {
  name: v.string(),
  category: v.string(),
  customCategory: v.optional(v.string()),
  status: v.optional(VENDOR_STATUS),
  priceTotal: v.optional(v.number()),
  priceUnit: v.optional(PRICE_UNIT),
  includes: v.optional(v.array(v.string())),
  contactName: v.optional(v.string()),
  phone: v.optional(v.string()),
  email: v.optional(v.string()),
  website: v.optional(v.string()),
  location: v.optional(v.string()),
  notes: v.optional(v.string()),
  links: v.optional(v.array(LINK)),
  depositAmount: v.optional(v.number()),
  depositPaidAt: v.optional(v.number()),
  finalDueAt: v.optional(v.number()),
  finalPaidAt: v.optional(v.number()),
  rating: v.optional(v.number()),
  pros: v.optional(v.string()),
  cons: v.optional(v.string()),
};

export const add = mutation({
  args: vendorFields,
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);
    const now = Date.now();
    const id = await ctx.db.insert("vendors", {
      name: args.name.trim(),
      category: args.category,
      customCategory: args.customCategory?.trim() || undefined,
      status: args.status ?? "considering",
      priceTotal: args.priceTotal,
      priceUnit: args.priceUnit,
      includes: args.includes ?? [],
      contactName: args.contactName?.trim() || undefined,
      phone: args.phone?.trim() || undefined,
      email: args.email?.trim() || undefined,
      website: args.website?.trim() || undefined,
      location: args.location?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
      links: args.links ?? [],
      depositAmount: args.depositAmount,
      depositPaidAt: args.depositPaidAt,
      finalDueAt: args.finalDueAt,
      finalPaidAt: args.finalPaidAt,
      rating: args.rating,
      pros: args.pros?.trim() || undefined,
      cons: args.cons?.trim() || undefined,
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
    });
    return { id };
  },
});

export const update = mutation({
  args: {
    id: v.id("vendors"),
    ...vendorFields,
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Vendor not found");
    const now = Date.now();
    await ctx.db.patch(args.id, {
      name: args.name.trim(),
      category: args.category,
      customCategory: args.customCategory?.trim() || undefined,
      status: args.status ?? existing.status,
      priceTotal: args.priceTotal,
      priceUnit: args.priceUnit,
      includes: args.includes ?? existing.includes,
      contactName: args.contactName?.trim() || undefined,
      phone: args.phone?.trim() || undefined,
      email: args.email?.trim() || undefined,
      website: args.website?.trim() || undefined,
      location: args.location?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
      links: args.links ?? existing.links,
      depositAmount: args.depositAmount,
      depositPaidAt: args.depositPaidAt,
      finalDueAt: args.finalDueAt,
      finalPaidAt: args.finalPaidAt,
      rating: args.rating,
      pros: args.pros?.trim() || undefined,
      cons: args.cons?.trim() || undefined,
      updatedAt: now,
    });
    return args.id;
  },
});

export const setStatus = mutation({
  args: { id: v.id("vendors"), status: VENDOR_STATUS },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Vendor not found");
    await ctx.db.patch(args.id, {
      status: args.status,
      updatedAt: Date.now(),
    });
  },
});

export const softDelete = mutation({
  args: { id: v.id("vendors") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Vendor not found");
    await ctx.db.patch(args.id, {
      deletedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const restore = mutation({
  args: { id: v.id("vendors") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Vendor not found");
    await ctx.db.patch(args.id, {
      deletedAt: undefined,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Insert many vendors at once. Each row is validated by the schema; on any
 * row failure we record the error string and continue. Returns a per-row
 * summary so the caller can surface partial successes.
 */
export const bulkAdd = mutation({
  args: { rows: v.array(v.object(vendorFields)) },
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);
    const now = Date.now();
    let inserted = 0;
    const errors: Array<{ index: number; message: string }> = [];

    for (let i = 0; i < args.rows.length; i++) {
      const r = args.rows[i];
      try {
        await ctx.db.insert("vendors", {
          name: r.name.trim(),
          category: r.category,
          customCategory: r.customCategory?.trim() || undefined,
          status: r.status ?? "considering",
          priceTotal: r.priceTotal,
          priceUnit: r.priceUnit,
          includes: r.includes ?? [],
          contactName: r.contactName?.trim() || undefined,
          phone: r.phone?.trim() || undefined,
          email: r.email?.trim() || undefined,
          website: r.website?.trim() || undefined,
          location: r.location?.trim() || undefined,
          notes: r.notes?.trim() || undefined,
          links: r.links ?? [],
          depositAmount: r.depositAmount,
          depositPaidAt: r.depositPaidAt,
          finalDueAt: r.finalDueAt,
          finalPaidAt: r.finalPaidAt,
          rating: r.rating,
          pros: r.pros?.trim() || undefined,
          cons: r.cons?.trim() || undefined,
          createdAt: now,
          createdBy: userId,
          updatedAt: now,
        });
        inserted++;
      } catch (err) {
        errors.push({
          index: i,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return { inserted, errors };
  },
});

export type Vendor = Doc<"vendors">;
export type VendorId = Id<"vendors">;

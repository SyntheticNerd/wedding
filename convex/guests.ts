import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { type Doc, type Id } from "./_generated/dataModel";
import { RSVP_STATUS, SIDE } from "./schema";
import {
  generateInvitationId,
  nameKey,
  normalizePhoneToE164,
} from "./lib/normalize";
import { requireAdmin } from "./lib/auth";

const guestFields = {
  firstName: v.string(),
  lastName: v.string(),
  aliases: v.optional(v.array(v.string())),
  phoneRaw: v.optional(v.string()),
  email: v.optional(v.string()),
  address: v.optional(
    v.object({
      line1: v.string(),
      line2: v.optional(v.string()),
      city: v.string(),
      region: v.string(),
      postalCode: v.string(),
      country: v.string(),
    }),
  ),
  invitationId: v.optional(v.string()),
  side: SIDE,
  isChild: v.optional(v.boolean()),
  rsvpStatus: v.optional(RSVP_STATUS),
  rsvpOffline: v.optional(v.boolean()),
  plusOneAllowed: v.optional(v.boolean()),
  plusOneName: v.optional(v.string()),
  plusOneRsvp: v.optional(v.union(v.literal("yes"), v.literal("no"))),
  dietaryNotes: v.optional(v.string()),
  noteToCouple: v.optional(v.string()),
  adminNotes: v.optional(v.string()),
};

/* ----------------------------------------------------------------------
   List & search
   -------------------------------------------------------------------- */

export const list = query({
  args: {
    side: v.optional(SIDE),
    status: v.optional(RSVP_STATUS),
    search: v.optional(v.string()),
    includeDeleted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const all = await ctx.db.query("guests").collect();
    const filtered = all
      .filter((g) =>
        args.includeDeleted ? true : g.deletedAt === undefined,
      )
      .filter((g) => (args.side ? g.side === args.side : true))
      .filter((g) =>
        args.status ? g.rsvpStatus === args.status : true,
      )
      .filter((g) => {
        if (!args.search) return true;
        const q = nameKey(args.search);
        if (!q) return true;
        if (nameKey(g.firstName).includes(q)) return true;
        if (nameKey(g.lastName).includes(q)) return true;
        if (g.aliases.some((a: string) => nameKey(a).includes(q))) return true;
        if (g.email && g.email.toLowerCase().includes(q)) return true;
        return false;
      })
      .sort((a, b) => {
        const byLast = a.lastName.localeCompare(b.lastName);
        if (byLast !== 0) return byLast;
        return a.firstName.localeCompare(b.firstName);
      });
    return filtered;
  },
});

export const get = query({
  args: { id: v.id("guests") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db.get(args.id);
  },
});

export const rollups = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const all = await ctx.db
      .query("guests")
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();
    const total = all.length;
    const bySide = (s: Doc<"guests">["side"]) =>
      all.filter((g) => g.side === s).length;
    const byStatus = (s: Doc<"guests">["rsvpStatus"]) =>
      all.filter((g) => g.rsvpStatus === s).length;

    const plusOnesAllowed = all.filter((g) => g.plusOneAllowed).length;
    // Defensive: only count plus-ones whose primary still has the toggle on.
    // Prevents stale `plusOneRsvp` from a previously-allowed guest from
    // inflating the rollups if the form layer ever leaks a stale value.
    const plusOnesYes = all.filter(
      (g) => g.plusOneAllowed && g.plusOneRsvp === "yes",
    ).length;
    const plusOnesNo = all.filter(
      (g) => g.plusOneAllowed && g.plusOneRsvp === "no",
    ).length;
    // A plus-one is "potential" if it's been allowed but the guest's primary
    // RSVP isn't "no" and the plus-one hasn't explicitly declined.
    const plusOnesPending = all.filter(
      (g) =>
        g.plusOneAllowed &&
        g.plusOneRsvp == null &&
        g.rsvpStatus !== "no",
    ).length;

    const yes = byStatus("yes");
    const pending = byStatus("pending");
    const no = byStatus("no");

    // Today's confirmed seats.
    const confirmed = yes + plusOnesYes;
    // Worst-case if every pending guest + every unresolved plus-one says yes.
    const projectedMax = yes + pending + plusOnesYes + plusOnesPending;

    return {
      total,
      bride: bySide("bride"),
      groom: bySide("groom"),
      both: bySide("both"),
      yes,
      no,
      pending,
      plusOnesAllowed,
      plusOnesYes,
      plusOnesNo,
      plusOnesPending,
      // Headcount terminology kept as alias for older callers.
      attending: confirmed,
      confirmed,
      projectedMax,
    };
  },
});

export const auditFor = query({
  args: { guestId: v.id("guests") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db
      .query("rsvpAuditLog")
      .withIndex("by_guest", (q) => q.eq("guestId", args.guestId))
      .order("desc")
      .collect();
  },
});

/**
 * Group active guests by invitationId for the admin invitations page.
 * Each group is a household — used to render printable QR cards that link
 * to /rsvp?invitation=<id>.
 */
export const listInvitations = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const all = await ctx.db.query("guests").collect();
    const groups = new Map<
      string,
      {
        invitationId: string;
        guests: Array<{
          id: Id<"guests">;
          firstName: string;
          lastName: string;
          rsvpStatus: Doc<"guests">["rsvpStatus"];
          hasPhone: boolean;
        }>;
      }
    >();
    for (const g of all) {
      if (g.deletedAt) continue;
      const entry = groups.get(g.invitationId) ?? {
        invitationId: g.invitationId,
        guests: [],
      };
      entry.guests.push({
        id: g._id,
        firstName: g.firstName,
        lastName: g.lastName,
        rsvpStatus: g.rsvpStatus,
        hasPhone: Boolean(g.phoneE164),
      });
      groups.set(g.invitationId, entry);
    }
    // Sort each group's guests by first name; sort groups by primary last name.
    const out = Array.from(groups.values()).map((g) => ({
      ...g,
      guests: g.guests.sort((a, b) =>
        a.firstName.localeCompare(b.firstName),
      ),
    }));
    out.sort((a, b) =>
      (a.guests[0]?.lastName ?? "").localeCompare(b.guests[0]?.lastName ?? ""),
    );
    return out;
  },
});

/* ----------------------------------------------------------------------
   Mutations
   -------------------------------------------------------------------- */

export const create = mutation({
  args: guestFields,
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);
    const now = Date.now();
    const phoneE164 = args.phoneRaw
      ? normalizePhoneToE164(args.phoneRaw)
      : undefined;
    const id = await ctx.db.insert("guests", {
      firstName: args.firstName.trim(),
      lastName: args.lastName.trim(),
      aliases: args.aliases ?? [],
      phoneE164: phoneE164 ?? undefined,
      email: args.email?.trim() || undefined,
      address: args.address,
      invitationId: args.invitationId ?? generateInvitationId(),
      side: args.side,
      isChild: args.isChild ?? false,
      rsvpStatus: args.rsvpStatus ?? "pending",
      rsvpOffline: args.rsvpOffline ?? false,
      plusOneAllowed: args.plusOneAllowed ?? false,
      plusOneName: args.plusOneName,
      plusOneRsvp: args.plusOneRsvp,
      dietaryNotes: args.dietaryNotes,
      noteToCouple: args.noteToCouple,
      adminNotes: args.adminNotes,
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
    });
    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("guests"),
    ...guestFields,
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Guest not found");

    const phoneE164 =
      args.phoneRaw !== undefined
        ? normalizePhoneToE164(args.phoneRaw) ?? undefined
        : existing.phoneE164;

    const before = pickAuditFields(existing);
    const nextRsvpStatus = args.rsvpStatus ?? existing.rsvpStatus;
    const rsvpAt =
      nextRsvpStatus !== existing.rsvpStatus && nextRsvpStatus !== "pending"
        ? Date.now()
        : existing.rsvpAt;
    const next = {
      firstName: args.firstName.trim(),
      lastName: args.lastName.trim(),
      aliases: args.aliases ?? existing.aliases,
      phoneE164,
      email: args.email?.trim() || undefined,
      address: args.address ?? existing.address,
      invitationId: args.invitationId ?? existing.invitationId,
      side: args.side,
      isChild: args.isChild ?? existing.isChild,
      rsvpStatus: nextRsvpStatus,
      rsvpAt,
      rsvpOffline: args.rsvpOffline ?? existing.rsvpOffline,
      plusOneAllowed: args.plusOneAllowed ?? existing.plusOneAllowed,
      plusOneName: args.plusOneName,
      plusOneRsvp: args.plusOneRsvp,
      dietaryNotes: args.dietaryNotes,
      noteToCouple: args.noteToCouple,
      adminNotes: args.adminNotes,
      updatedAt: Date.now(),
    };
    await ctx.db.patch(args.id, next);
    const after = pickAuditFields({ ...existing, ...next });
    if (auditWorthyChanged(before, after)) {
      await ctx.db.insert("rsvpAuditLog", {
        guestId: args.id,
        invitationId: next.invitationId,
        changedAt: Date.now(),
        changedBy: "admin",
        changedByUserId: userId,
        before,
        after,
      });
    }
    return args.id;
  },
});

export const softDelete = mutation({
  args: { id: v.id("guests") },
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Guest not found");
    const now = Date.now();
    await ctx.db.patch(args.id, { deletedAt: now });
    await ctx.db.insert("rsvpAuditLog", {
      guestId: args.id,
      invitationId: existing.invitationId,
      changedAt: now,
      changedBy: "admin",
      changedByUserId: userId,
      before: { deletedAt: undefined },
      after: { deletedAt: now },
    });
  },
});

export const restore = mutation({
  args: { id: v.id("guests") },
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Guest not found");
    const now = Date.now();
    await ctx.db.patch(args.id, { deletedAt: undefined });
    await ctx.db.insert("rsvpAuditLog", {
      guestId: args.id,
      invitationId: existing.invitationId,
      changedAt: now,
      changedBy: "admin",
      changedByUserId: userId,
      before: { deletedAt: existing.deletedAt },
      after: { deletedAt: undefined },
    });
  },
});

/* ----------------------------------------------------------------------
   Bulk import — accepts an array of guest rows.
   The CSV is parsed client-side; we accept JSON here.
   -------------------------------------------------------------------- */

export const bulkImport = mutation({
  args: {
    rows: v.array(
      v.object({
        firstName: v.string(),
        lastName: v.string(),
        aliases: v.optional(v.array(v.string())),
        phoneRaw: v.optional(v.string()),
        email: v.optional(v.string()),
        side: SIDE,
        isChild: v.optional(v.boolean()),
        plusOneAllowed: v.optional(v.boolean()),
        plusOneName: v.optional(v.string()),
        invitationId: v.optional(v.string()),
        adminNotes: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);
    const now = Date.now();
    let inserted = 0;
    for (const r of args.rows) {
      const phoneE164 = r.phoneRaw
        ? normalizePhoneToE164(r.phoneRaw) ?? undefined
        : undefined;
      await ctx.db.insert("guests", {
        firstName: r.firstName.trim(),
        lastName: r.lastName.trim(),
        aliases: r.aliases ?? [],
        phoneE164,
        email: r.email?.trim() || undefined,
        invitationId: r.invitationId ?? generateInvitationId(),
        side: r.side,
        isChild: r.isChild ?? false,
        rsvpStatus: "pending",
        rsvpOffline: false,
        plusOneAllowed: r.plusOneAllowed ?? false,
        plusOneName: r.plusOneName,
        adminNotes: r.adminNotes,
        createdAt: now,
        createdBy: userId,
        updatedAt: now,
      });
      inserted++;
    }
    return { inserted };
  },
});

/* ----------------------------------------------------------------------
   Helpers (private)
   -------------------------------------------------------------------- */

type AuditFields = Pick<
  Doc<"guests">,
  | "rsvpStatus"
  | "rsvpOffline"
  | "plusOneAllowed"
  | "plusOneRsvp"
  | "plusOneName"
  | "dietaryNotes"
  | "noteToCouple"
>;

function pickAuditFields(g: {
  rsvpStatus: Doc<"guests">["rsvpStatus"];
  rsvpOffline: boolean;
  plusOneAllowed: boolean;
  plusOneRsvp?: Doc<"guests">["plusOneRsvp"];
  plusOneName?: string;
  dietaryNotes?: string;
  noteToCouple?: string;
}): AuditFields {
  return {
    rsvpStatus: g.rsvpStatus,
    rsvpOffline: g.rsvpOffline,
    plusOneAllowed: g.plusOneAllowed,
    plusOneRsvp: g.plusOneRsvp,
    plusOneName: g.plusOneName,
    dietaryNotes: g.dietaryNotes,
    noteToCouple: g.noteToCouple,
  };
}

function auditWorthyChanged(a: AuditFields, b: AuditFields): boolean {
  return (
    a.rsvpStatus !== b.rsvpStatus ||
    a.rsvpOffline !== b.rsvpOffline ||
    a.plusOneAllowed !== b.plusOneAllowed ||
    a.plusOneRsvp !== b.plusOneRsvp ||
    a.plusOneName !== b.plusOneName ||
    a.dietaryNotes !== b.dietaryNotes ||
    a.noteToCouple !== b.noteToCouple
  );
}

// Re-export type for client consumers
export type Guest = Doc<"guests">;
export type GuestId = Id<"guests">;

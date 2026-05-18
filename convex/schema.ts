import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const RSVP_STATUS = v.union(
  v.literal("pending"),
  v.literal("yes"),
  v.literal("no"),
);

export const SIDE = v.union(
  v.literal("bride"),
  v.literal("groom"),
  v.literal("both"),
);

export default defineSchema({
  guests: defineTable({
    firstName: v.string(),
    lastName: v.string(),
    aliases: v.array(v.string()),
    phoneE164: v.optional(v.string()),
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
    invitationId: v.string(),
    side: SIDE,
    isChild: v.boolean(),
    rsvpStatus: RSVP_STATUS,
    rsvpAt: v.optional(v.number()),
    rsvpOffline: v.boolean(),
    plusOneAllowed: v.boolean(),
    plusOneName: v.optional(v.string()),
    plusOneRsvp: v.optional(v.union(v.literal("yes"), v.literal("no"))),
    dietaryNotes: v.optional(v.string()),
    noteToCouple: v.optional(v.string()),
    adminNotes: v.optional(v.string()),
    createdAt: v.number(),
    createdBy: v.string(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_lastName", ["lastName", "firstName"])
    .index("by_invitation", ["invitationId"])
    .index("by_side", ["side"])
    .index("by_phone", ["phoneE164"])
    .searchIndex("search_name", {
      searchField: "lastName",
      filterFields: ["side", "rsvpStatus", "deletedAt"],
    }),

  rsvpAuditLog: defineTable({
    guestId: v.id("guests"),
    invitationId: v.string(),
    changedAt: v.number(),
    changedBy: v.union(v.literal("guest"), v.literal("admin")),
    changedByUserId: v.optional(v.string()),
    before: v.any(),
    after: v.any(),
  }).index("by_guest", ["guestId", "changedAt"]),

  settings: defineTable({
    key: v.string(),
    value: v.any(),
    updatedAt: v.number(),
    updatedBy: v.string(),
  }).index("by_key", ["key"]),

  adminProfiles: defineTable({
    clerkUserId: v.string(),
    displayName: v.string(),
    email: v.optional(v.string()),
    emailNotificationsEnabled: v.boolean(),
  }).index("by_clerk_user", ["clerkUserId"]),

  /* Public "have a question?" contact form submissions. Auth-free, so
     length caps + a honeypot field on the public mutation are the only
     defenses. Admin reads via /admin/messages. */
  messages: defineTable({
    name: v.string(),
    email: v.string(),
    subject: v.string(),
    message: v.string(),
    phoneRaw: v.optional(v.string()),
    phoneE164: v.optional(v.string()),
    createdAt: v.number(),
    readAt: v.optional(v.number()),
    repliedAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
  })
    .index("by_created", ["createdAt"])
    .index("by_unread", ["readAt", "createdAt"]),

  vendors: defineTable({
    name: v.string(),
    category: v.string(),
    customCategory: v.optional(v.string()),
    status: v.union(
      v.literal("considering"),
      v.literal("chosen"),
      v.literal("passed"),
    ),

    priceTotal: v.optional(v.number()),
    priceUnit: v.optional(
      v.union(
        v.literal("flat"),
        v.literal("per_head"),
        v.literal("per_hour"),
      ),
    ),
    includes: v.array(v.string()),

    contactName: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    website: v.optional(v.string()),
    location: v.optional(v.string()),

    notes: v.optional(v.string()),
    links: v.array(
      v.object({
        label: v.string(),
        url: v.string(),
      }),
    ),

    depositAmount: v.optional(v.number()),
    depositPaidAt: v.optional(v.number()),
    finalDueAt: v.optional(v.number()),
    finalPaidAt: v.optional(v.number()),

    rating: v.optional(v.number()),
    pros: v.optional(v.string()),
    cons: v.optional(v.string()),

    createdAt: v.number(),
    createdBy: v.string(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_category", ["category", "status"])
    .index("by_status", ["status"])
    .searchIndex("search_name", {
      searchField: "name",
      filterFields: ["category", "status", "deletedAt"],
    }),
});

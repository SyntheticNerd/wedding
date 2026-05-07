/**
 * Public contact-form layer + admin-side mailbox queries.
 *
 * The `send` mutation is auth-free; defenses are length caps, a hidden
 * honeypot field, and basic email-shape validation. Personal-wedding
 * scale — we accept that a determined spammer can still get through;
 * the admin can soft-delete anything noisy.
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { type Doc } from "./_generated/dataModel";
import { normalizePhoneToE164 } from "./lib/normalize";
import { requireAdmin } from "./lib/auth";

const MAX_NAME = 120;
const MAX_EMAIL = 254;
const MAX_SUBJECT = 200;
const MAX_MESSAGE = 4000;
const MAX_PHONE = 40;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ----------------------------------------------------------------------
   Public submit
   -------------------------------------------------------------------- */

export const send = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    subject: v.string(),
    message: v.string(),
    phoneRaw: v.optional(v.string()),
    /** Honeypot — must be empty. Real users never see this field. */
    website: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.website && args.website.trim().length > 0) {
      // Bot trap. Pretend success so scrapers don't learn.
      return { ok: true as const };
    }

    const name = args.name.trim();
    const email = args.email.trim();
    const subject = args.subject.trim();
    const message = args.message.trim();
    const phoneRaw = args.phoneRaw?.trim();

    if (!name || !email || !subject || !message) {
      throw new Error("Name, email, subject, and message are required.");
    }
    if (name.length > MAX_NAME) throw new Error("Name is too long.");
    if (email.length > MAX_EMAIL) throw new Error("Email is too long.");
    if (subject.length > MAX_SUBJECT) throw new Error("Subject is too long.");
    if (message.length > MAX_MESSAGE) throw new Error("Message is too long.");
    if (phoneRaw && phoneRaw.length > MAX_PHONE) {
      throw new Error("Phone is too long.");
    }
    if (!EMAIL_RE.test(email)) {
      throw new Error("That doesn't look like a valid email address.");
    }

    const phoneE164 = phoneRaw ? normalizePhoneToE164(phoneRaw) : null;

    const id = await ctx.db.insert("messages", {
      name,
      email,
      subject,
      message,
      phoneRaw: phoneRaw || undefined,
      phoneE164: phoneE164 ?? undefined,
      createdAt: Date.now(),
    });

    // Fire-and-forget admin notification. Failures (missing API key,
    // transport hiccup) are logged inside the action — they don't block
    // the public submit.
    await ctx.scheduler.runAfter(
      0,
      internal.notifications.sendContactMessageNotification,
      { messageId: id },
    );

    return { ok: true as const };
  },
});

/* ----------------------------------------------------------------------
   Admin reads + state changes
   -------------------------------------------------------------------- */

export const list = query({
  args: { includeDeleted: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const all = await ctx.db
      .query("messages")
      .withIndex("by_created")
      .order("desc")
      .collect();
    return all.filter((m) =>
      args.includeDeleted ? true : m.deletedAt === undefined,
    );
  },
});

export const get = query({
  args: { id: v.id("messages") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db.get(args.id);
  },
});

export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const all = await ctx.db.query("messages").collect();
    return all.filter((m) => !m.deletedAt && !m.readAt).length;
  },
});

export const markRead = mutation({
  args: { id: v.id("messages") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const m = await ctx.db.get(args.id);
    if (!m) throw new Error("Message not found");
    if (!m.readAt) await ctx.db.patch(args.id, { readAt: Date.now() });
  },
});

export const markUnread = mutation({
  args: { id: v.id("messages") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const m = await ctx.db.get(args.id);
    if (!m) throw new Error("Message not found");
    await ctx.db.patch(args.id, { readAt: undefined });
  },
});

export const markReplied = mutation({
  args: { id: v.id("messages") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const m = await ctx.db.get(args.id);
    if (!m) throw new Error("Message not found");
    await ctx.db.patch(args.id, {
      repliedAt: Date.now(),
      readAt: m.readAt ?? Date.now(),
    });
  },
});

export const softDelete = mutation({
  args: { id: v.id("messages") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const m = await ctx.db.get(args.id);
    if (!m) throw new Error("Message not found");
    await ctx.db.patch(args.id, { deletedAt: Date.now() });
  },
});

export type ContactMessage = Doc<"messages">;

"use node";

/**
 * Resend-backed admin notifications for RSVP submissions.
 *
 * Runs in the Node.js runtime because the `resend` SDK uses Node APIs.
 * Triggered via `ctx.scheduler.runAfter(0, ...)` from the public submitRsvp
 * mutation so we never block the guest on transport.
 *
 * Failure modes are intentionally soft:
 *  - Missing RESEND_API_KEY logs a warning and returns. We don't want the
 *    public mutation to retry on email-infrastructure issues.
 *  - Per-admin send errors are caught and logged; one bad address shouldn't
 *    starve the others.
 */
import { Resend } from "resend";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { type Doc, type Id } from "./_generated/dataModel";

export const sendRsvpNotification = internalAction({
  args: { guestId: v.id("guests") },
  handler: async (ctx, args) => {
    const data = await ctx.runQuery(
      internal.notificationsData.loadNotificationContext,
      { guestId: args.guestId },
    );
    if (!data) return null;

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn(
        "[notifications] RESEND_API_KEY not set — skipping RSVP email " +
          `for guest ${args.guestId}`,
      );
      return null;
    }
    const fromEmail =
      process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
    const adminBaseUrl =
      process.env.ADMIN_BASE_URL ?? "https://www.andrewandjewel.com";

    const resend = new Resend(apiKey);
    const subject = buildSubject(data.guest);
    const html = buildHtml({
      guest: data.guest,
      adminUrl: `${adminBaseUrl}/admin/guests/${data.guest._id}`,
    });
    const text = buildText({
      guest: data.guest,
      adminUrl: `${adminBaseUrl}/admin/guests/${data.guest._id}`,
    });

    for (const recipient of data.recipients) {
      try {
        await resend.emails.send({
          from: fromEmail,
          to: recipient.email,
          subject,
          html,
          text,
        });
      } catch (err) {
        console.error(
          `[notifications] failed to send to ${recipient.email}:`,
          err,
        );
      }
    }
    return null;
  },
});

/* ----------------------------------------------------------------------
   Templating (kept inline — small enough that pulling in React Email
   would be overkill)
   -------------------------------------------------------------------- */

function buildSubject(g: Doc<"guests">): string {
  const status = g.rsvpStatus === "yes" ? "yes" : g.rsvpStatus === "no" ? "no" : "update";
  return `RSVP from ${g.firstName} ${g.lastName}: ${status}`;
}

function buildText({
  guest: g,
  adminUrl,
}: {
  guest: Doc<"guests">;
  adminUrl: string;
}): string {
  const lines = [
    `${g.firstName} ${g.lastName} — ${g.rsvpStatus.toUpperCase()}`,
    g.plusOneAllowed
      ? `Plus-one: ${g.plusOneRsvp ?? "no response"}${
          g.plusOneName ? ` (${g.plusOneName})` : ""
        }`
      : null,
    g.dietaryNotes ? `Dietary: ${g.dietaryNotes}` : null,
    g.noteToCouple ? `Note to couple: ${g.noteToCouple}` : null,
    "",
    `Open in admin: ${adminUrl}`,
  ].filter(Boolean);
  return lines.join("\n");
}

function buildHtml({
  guest: g,
  adminUrl,
}: {
  guest: Doc<"guests">;
  adminUrl: string;
}): string {
  const statusLabel =
    g.rsvpStatus === "yes"
      ? "Attending"
      : g.rsvpStatus === "no"
        ? "Not attending"
        : "Updated";
  const statusColor =
    g.rsvpStatus === "yes"
      ? "#5b8a5e"
      : g.rsvpStatus === "no"
        ? "#b15555"
        : "#6e6862";
  const rows: string[] = [];
  if (g.plusOneAllowed) {
    rows.push(
      row(
        "Plus-one",
        g.plusOneRsvp
          ? `${cap(g.plusOneRsvp)}${g.plusOneName ? ` — ${escape(g.plusOneName)}` : ""}`
          : "<em>no response</em>",
      ),
    );
  }
  if (g.dietaryNotes) rows.push(row("Dietary", escape(g.dietaryNotes)));
  if (g.noteToCouple)
    rows.push(row("Note to couple", escape(g.noteToCouple)));

  return `<!doctype html>
<html>
  <body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#FAF6F1;color:#2E2A26;padding:24px;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #eee;">
      <p style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#888;margin:0;">RSVP received</p>
      <h1 style="font-family:Cormorant Garamond,Georgia,serif;font-size:32px;line-height:1.2;margin:8px 0 16px;">
        ${escape(g.firstName)} ${escape(g.lastName)}
      </h1>
      <p style="margin:0 0 24px;">
        <span style="display:inline-block;padding:6px 12px;border-radius:999px;font-size:12px;font-weight:600;background:${statusColor};color:#fff;">
          ${statusLabel}
        </span>
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        ${rows.join("")}
      </table>
      <p style="margin-top:32px;">
        <a href="${escape(adminUrl)}" style="color:#5b8a5e;font-weight:600;">Open in admin →</a>
      </p>
    </div>
  </body>
</html>`;
}

function row(label: string, value: string): string {
  return `
    <tr>
      <td style="padding:8px 0;color:#888;width:140px;vertical-align:top;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;">${label}</td>
      <td style="padding:8px 0;vertical-align:top;">${value}</td>
    </tr>`;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* ----------------------------------------------------------------------
   Contact-form messages → admin inbox
   -------------------------------------------------------------------- */

const CONTACT_RECIPIENT =
  process.env.CONTACT_NOTIFICATION_EMAIL ?? "andrewandjewel@gmail.com";

export const sendContactMessageNotification = internalAction({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const data = await ctx.runQuery(
      internal.notificationsData.loadMessageContext,
      { messageId: args.messageId },
    );
    if (!data) return null;

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn(
        "[notifications] RESEND_API_KEY not set — skipping contact message " +
          `email for ${args.messageId}`,
      );
      return null;
    }
    const fromEmail =
      process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
    const adminBaseUrl =
      process.env.ADMIN_BASE_URL ?? "https://www.andrewandjewel.com";

    const resend = new Resend(apiKey);
    const adminUrl = `${adminBaseUrl}/admin/messages`;
    const subject = `[Andrew & Jewel] ${data.message.subject}`;
    const html = buildMessageHtml({ message: data.message, adminUrl });
    const text = buildMessageText({ message: data.message, adminUrl });

    try {
      await resend.emails.send({
        from: fromEmail,
        to: CONTACT_RECIPIENT,
        replyTo: data.message.email,
        subject,
        html,
        text,
      });
    } catch (err) {
      console.error(
        `[notifications] failed to send contact message email:`,
        err,
      );
    }
    return null;
  },
});

function buildMessageText({
  message,
  adminUrl,
}: {
  message: Doc<"messages">;
  adminUrl: string;
}): string {
  const lines = [
    `From: ${message.name} <${message.email}>`,
    message.phoneRaw ? `Phone: ${message.phoneRaw}` : null,
    `Subject: ${message.subject}`,
    "",
    message.message,
    "",
    `Open in admin: ${adminUrl}`,
  ].filter(Boolean);
  return lines.join("\n");
}

function buildMessageHtml({
  message,
  adminUrl,
}: {
  message: Doc<"messages">;
  adminUrl: string;
}): string {
  const phoneRow = message.phoneRaw
    ? row("Phone", escape(message.phoneRaw))
    : "";
  return `<!doctype html>
<html>
  <body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#FAF6F1;color:#2E2A26;padding:24px;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #eee;">
      <p style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#888;margin:0;">New message</p>
      <h1 style="font-family:Cormorant Garamond,Georgia,serif;font-size:28px;line-height:1.2;margin:8px 0 16px;">
        ${escape(message.subject)}
      </h1>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:16px;">
        ${row("From", `${escape(message.name)} &lt;<a href="mailto:${escape(message.email)}" style="color:#5b8a5e;">${escape(message.email)}</a>&gt;`)}
        ${phoneRow}
      </table>
      <div style="white-space:pre-wrap;background:#FAF6F1;border-radius:8px;padding:16px;line-height:1.5;">
        ${escape(message.message)}
      </div>
      <p style="margin-top:24px;">
        <a href="${escape(adminUrl)}" style="color:#5b8a5e;font-weight:600;">Open in admin →</a>
      </p>
    </div>
  </body>
</html>`;
}

// Re-export for type discoverability
export type RsvpNotificationGuestId = Id<"guests">;
export type ContactMessageId = Id<"messages">;

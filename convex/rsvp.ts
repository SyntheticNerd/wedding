/**
 * Public RSVP layer.
 *
 * These functions are intentionally NOT auth-gated — guests are not signed in.
 * Authorization is bearer-token-style: the caller must present
 * `last4` (last 4 of the guest's phone) on every request, and we re-verify
 * server-side. For QR-linked invitations (`?invitation=` query param), the
 * invitationId acts as a secondary token; if the guest has no phone on file
 * we accept the invitationId alone (a personal-wedding-grade tradeoff).
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { type Doc, type Id } from "./_generated/dataModel";
import { lastFourDigits, matchesAlias } from "./lib/normalize";

const PLUS_ONE_RSVP = v.union(v.literal("yes"), v.literal("no"));
const PUBLIC_RSVP_STATUS = v.union(v.literal("yes"), v.literal("no"));

/* ----------------------------------------------------------------------
   Lookup
   -------------------------------------------------------------------- */

/**
 * The shape we expose to unauthenticated callers — just enough to drive a
 * chooser UI without leaking phone numbers or addresses.
 */
type LookupCandidate = {
  id: Id<"guests">;
  firstName: string;
  lastName: string;
  /** Last 2 of postal code, when available — the chooser disambiguator. */
  postalSuffix?: string;
  hasPhone: boolean;
  rsvpStatus: Doc<"guests">["rsvpStatus"];
};

function toCandidate(g: Doc<"guests">): LookupCandidate {
  const postal = g.address?.postalCode?.replace(/\s+/g, "") ?? "";
  return {
    id: g._id,
    firstName: g.firstName,
    lastName: g.lastName,
    postalSuffix: postal.length >= 2 ? postal.slice(-2) : undefined,
    hasPhone: Boolean(g.phoneE164),
    rsvpStatus: g.rsvpStatus,
  };
}

export const findGuestForRsvp = query({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    last4: v.string(),
    invitationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const last4 = args.last4.replace(/\D/g, "").slice(-4);
    if (last4.length !== 4) return { kind: "none" as const };

    // Pull a small candidate set. By-invitation index gives us O(household);
    // otherwise scan recent guests (small list — wedding-scale is ~150).
    const candidates = args.invitationId
      ? await ctx.db
          .query("guests")
          .withIndex("by_invitation", (q) =>
            q.eq("invitationId", args.invitationId!),
          )
          .collect()
      : await ctx.db.query("guests").collect();

    const matches = candidates.filter((g) => {
      if (g.deletedAt) return false;
      // Name match against firstName, lastName, or aliases (NFD-normalized).
      if (
        !matchesAlias(args.firstName, g) ||
        !matchesAlias(args.lastName, g)
      ) {
        return false;
      }
      // Phone last-4 must match. If no phone on file, this guest can't be
      // looked up by name+last4 — admins handle them via offline RSVP.
      const guestLast4 = lastFourDigits(g.phoneE164);
      return guestLast4 === last4;
    });

    if (matches.length === 0) return { kind: "none" as const };
    if (matches.length === 1) {
      return { kind: "one" as const, candidate: toCandidate(matches[0]) };
    }
    return {
      kind: "many" as const,
      candidates: matches.map(toCandidate),
    };
  },
});

/**
 * For QR-code entry: load the household by invitationId so the user can
 * pick their name from a list. Returns minimal info — the chooser still
 * confirms with phone last-4 (or the invitationId itself if no phone).
 */
export const getInvitationCandidates = query({
  args: { invitationId: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("guests")
      .withIndex("by_invitation", (q) => q.eq("invitationId", args.invitationId))
      .collect();
    return rows
      .filter((g) => !g.deletedAt)
      .map(toCandidate)
      .sort((a, b) => a.firstName.localeCompare(b.firstName));
  },
});

/* ----------------------------------------------------------------------
   Pre-fill form data — gated by last4 (or invitationId for phoneless guests)
   -------------------------------------------------------------------- */

type RsvpFormGuest = {
  id: Id<"guests">;
  firstName: string;
  lastName: string;
  invitationId: string;
  rsvpStatus: Doc<"guests">["rsvpStatus"];
  plusOneAllowed: boolean;
  plusOneName?: string;
  plusOneRsvp?: "yes" | "no";
  dietaryNotes?: string;
  noteToCouple?: string;
};

function projectForm(g: Doc<"guests">): RsvpFormGuest {
  return {
    id: g._id,
    firstName: g.firstName,
    lastName: g.lastName,
    invitationId: g.invitationId,
    rsvpStatus: g.rsvpStatus,
    plusOneAllowed: g.plusOneAllowed,
    plusOneName: g.plusOneName,
    plusOneRsvp: g.plusOneRsvp,
    dietaryNotes: g.dietaryNotes,
    noteToCouple: g.noteToCouple,
  };
}

/**
 * Verifies the supplied last4 (or invitationId fallback) and returns the
 * guest's RSVP-form-relevant fields. Used by the public form to pre-fill.
 */
export const getGuestForRsvp = query({
  args: {
    guestId: v.id("guests"),
    last4: v.optional(v.string()),
    invitationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const g = await ctx.db.get(args.guestId);
    if (!g || g.deletedAt) return null;

    const ok = verifyToken(g, {
      last4: args.last4,
      invitationId: args.invitationId,
    });
    if (!ok) return null;

    return projectForm(g);
  },
});

/* ----------------------------------------------------------------------
   Submit
   -------------------------------------------------------------------- */

export const submitRsvp = mutation({
  args: {
    guestId: v.id("guests"),
    last4: v.optional(v.string()),
    invitationId: v.optional(v.string()),
    rsvpStatus: PUBLIC_RSVP_STATUS,
    plusOneRsvp: v.optional(PLUS_ONE_RSVP),
    plusOneName: v.optional(v.string()),
    dietaryNotes: v.optional(v.string()),
    noteToCouple: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const g = await ctx.db.get(args.guestId);
    if (!g || g.deletedAt) throw new Error("Guest not found");

    if (
      !verifyToken(g, {
        last4: args.last4,
        invitationId: args.invitationId,
      })
    ) {
      throw new Error("Verification failed");
    }

    // Length caps — defends against accidental or malicious oversized payloads
    // that would balloon the audit table on every subsequent edit.
    if (args.noteToCouple && args.noteToCouple.length > 2000) {
      throw new Error("Note to couple is too long");
    }
    if (args.dietaryNotes && args.dietaryNotes.length > 1000) {
      throw new Error("Dietary notes are too long");
    }
    if (args.plusOneName && args.plusOneName.length > 120) {
      throw new Error("Plus-one name is too long");
    }

    // lockedAt cutoff — admins can still edit via authed path.
    const lockedAtRow = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "lockedAt"))
      .first();
    const lockedAt =
      typeof lockedAtRow?.value === "number" ? lockedAtRow.value : null;
    if (lockedAt !== null && Date.now() > lockedAt) {
      throw new Error("RSVPs are closed");
    }

    const now = Date.now();
    const before = pickAuditFields(g);

    // Plus-one rules:
    //   - declining (rsvpStatus=no) always clears plus-one — your plus-one
    //     can't come if you can't.
    //   - attending + allowed: take submitted values, but undefined args
    //     preserve the existing record so a partial mutation can't wipe data.
    //   - not allowed: ignore submitted values entirely.
    const plusOneAllowed = g.plusOneAllowed;
    const isAttending = args.rsvpStatus === "yes";
    const plusOneName =
      plusOneAllowed && isAttending
        ? args.plusOneName !== undefined
          ? args.plusOneName.trim() || undefined
          : g.plusOneName
        : undefined;
    const plusOneRsvp =
      plusOneAllowed && isAttending
        ? (args.plusOneRsvp ?? g.plusOneRsvp)
        : undefined;

    // Free-text fields: undefined preserves existing; explicit empty string
    // (after trim) clears.
    const dietaryNotes =
      args.dietaryNotes !== undefined
        ? args.dietaryNotes.trim() || undefined
        : g.dietaryNotes;
    const noteToCouple =
      args.noteToCouple !== undefined
        ? args.noteToCouple.trim() || undefined
        : g.noteToCouple;

    const next = {
      rsvpStatus: args.rsvpStatus,
      rsvpAt: now,
      plusOneName,
      plusOneRsvp,
      dietaryNotes,
      noteToCouple,
      updatedAt: now,
    };
    await ctx.db.patch(args.guestId, next);

    const merged: Doc<"guests"> = { ...g, ...next };
    const after = pickAuditFields(merged);
    if (auditWorthyChanged(before, after)) {
      await ctx.db.insert("rsvpAuditLog", {
        guestId: args.guestId,
        invitationId: g.invitationId,
        changedAt: now,
        changedBy: "guest",
        before,
        after,
      });
    }

    // Fire-and-forget admin notification. The action itself swallows
    // missing-API-key + transport errors so we never block the guest's
    // RSVP submission on email infrastructure.
    await ctx.scheduler.runAfter(
      0,
      internal.notifications.sendRsvpNotification,
      { guestId: args.guestId },
    );

    return { ok: true as const };
  },
});

/* ----------------------------------------------------------------------
   Helpers (private)
   -------------------------------------------------------------------- */

function verifyToken(
  guest: Doc<"guests">,
  args: { last4?: string; invitationId?: string },
): boolean {
  // Path 1: phone last-4 match.
  const guestLast4 = lastFourDigits(guest.phoneE164);
  const supplied = args.last4
    ? args.last4.replace(/\D/g, "").slice(-4)
    : undefined;
  if (supplied && guestLast4 && supplied.length === 4) {
    if (supplied === guestLast4) return true;
  }
  // Path 2: QR-link fallback for guests without a phone on file.
  if (
    args.invitationId &&
    args.invitationId === guest.invitationId &&
    !guest.phoneE164
  ) {
    return true;
  }
  return false;
}

type AuditFields = {
  rsvpStatus: Doc<"guests">["rsvpStatus"];
  plusOneRsvp?: Doc<"guests">["plusOneRsvp"];
  plusOneName?: string;
  dietaryNotes?: string;
  noteToCouple?: string;
};

function pickAuditFields(g: {
  rsvpStatus: Doc<"guests">["rsvpStatus"];
  plusOneRsvp?: Doc<"guests">["plusOneRsvp"];
  plusOneName?: string;
  dietaryNotes?: string;
  noteToCouple?: string;
}): AuditFields {
  return {
    rsvpStatus: g.rsvpStatus,
    plusOneRsvp: g.plusOneRsvp,
    plusOneName: g.plusOneName,
    dietaryNotes: g.dietaryNotes,
    noteToCouple: g.noteToCouple,
  };
}

function auditWorthyChanged(a: AuditFields, b: AuditFields): boolean {
  return (
    a.rsvpStatus !== b.rsvpStatus ||
    a.plusOneRsvp !== b.plusOneRsvp ||
    a.plusOneName !== b.plusOneName ||
    a.dietaryNotes !== b.dietaryNotes ||
    a.noteToCouple !== b.noteToCouple
  );
}

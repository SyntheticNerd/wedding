/**
 * Starter wedding-planning checklist.
 *
 * Lives in `convex/lib` so the `seedDefaults` mutation can insert it, and is
 * also imported by the admin UI for the canonical section ordering. Pure data
 * — no server-only dependencies — so it is safe to import on the client too.
 *
 * `category` (optional) is a vendor-category key from
 * `src/lib/vendor-categories.ts`. When set, the checklist row ties to the
 * vendor list: it surfaces whether a vendor in that category has been chosen,
 * and links straight to the filtered vendor view. Keep these keys in sync with
 * the `CATEGORIES` list there.
 */

export type ChecklistDefault = {
  section: string;
  title: string;
  /** Vendor-category key this task ties to (optional). */
  category?: string;
};

/**
 * Canonical display order for sections. Items in sections not listed here are
 * appended after these, alphabetically.
 */
export const SECTION_ORDER = [
  "Vendors to finalize",
  "Decor & details",
  "Attire & beauty",
  "Paper & guests",
  "Ceremony & reception",
  "Logistics & timeline",
  "After the wedding",
] as const;

export const CHECKLIST_DEFAULTS: ChecklistDefault[] = [
  // ── Vendors to finalize (each ties to the vendor list) ──────────────
  { section: "Vendors to finalize", title: "Confirm the venue", category: "venue" },
  { section: "Vendors to finalize", title: "Finalize catering & menu", category: "catering" },
  { section: "Vendors to finalize", title: "Finalize the bar / beverage plan", category: "bar" },
  { section: "Vendors to finalize", title: "Book the photographer", category: "photographer" },
  { section: "Vendors to finalize", title: "Book the videographer", category: "videographer" },
  { section: "Vendors to finalize", title: "Finalize florals & bouquets", category: "florist" },
  { section: "Vendors to finalize", title: "Finalize the DJ", category: "dj_music" },
  { section: "Vendors to finalize", title: "Decide on live / ceremony music", category: "live_music" },
  { section: "Vendors to finalize", title: "Order the cake & desserts", category: "cake" },
  { section: "Vendors to finalize", title: "Book the hair stylist", category: "hair" },
  { section: "Vendors to finalize", title: "Book the makeup artist", category: "makeup" },
  { section: "Vendors to finalize", title: "Reserve rentals (tables, chairs, linens)", category: "rentals" },
  { section: "Vendors to finalize", title: "Arrange lighting / AV", category: "lighting_av" },
  { section: "Vendors to finalize", title: "Confirm the officiant", category: "officiant" },
  { section: "Vendors to finalize", title: "Arrange transportation / shuttle", category: "transportation" },
  { section: "Vendors to finalize", title: "Order stationery & invitations", category: "stationery" },
  { section: "Vendors to finalize", title: "Confirm the day-of coordinator", category: "day_of_coordinator" },
  { section: "Vendors to finalize", title: "Order favors", category: "favors" },
  { section: "Vendors to finalize", title: "Book the photo booth", category: "photo_booth" },

  // ── Decor & details ────────────────────────────────────────────────
  { section: "Decor & details", title: "Finalize ceremony decor (arch, aisle, backdrop)" },
  { section: "Decor & details", title: "Choose reception centerpieces & decorations" },
  { section: "Decor & details", title: "Choose table settings & place cards" },
  { section: "Decor & details", title: "Design signage (welcome sign, seating chart, menus)" },
  { section: "Decor & details", title: "Plan the guestbook & card / gift box" },
  { section: "Decor & details", title: "Pick candles, linens & accent rentals" },
  { section: "Decor & details", title: "Plan the cake table & sweetheart table" },

  // ── Attire & beauty ────────────────────────────────────────────────
  { section: "Attire & beauty", title: "Choose & order the wedding dress", category: "bride_attire" },
  { section: "Attire & beauty", title: "Schedule dress alterations & fittings" },
  { section: "Attire & beauty", title: "Choose the groom's suit / tuxedo", category: "groom_attire" },
  { section: "Attire & beauty", title: "Coordinate wedding-party attire" },
  { section: "Attire & beauty", title: "Buy the wedding rings", category: "jewelry" },
  { section: "Attire & beauty", title: "Choose accessories & shoes" },
  { section: "Attire & beauty", title: "Book a hair & makeup trial" },

  // ── Paper & guests ─────────────────────────────────────────────────
  { section: "Paper & guests", title: "Finalize the guest list" },
  { section: "Paper & guests", title: "Send save-the-dates" },
  { section: "Paper & guests", title: "Address & mail invitations" },
  { section: "Paper & guests", title: "Track RSVPs" },
  { section: "Paper & guests", title: "Build the seating chart" },
  { section: "Paper & guests", title: "Order thank-you cards" },
  { section: "Paper & guests", title: "Finish the wedding website (FAQ, schedule, registry)" },

  // ── Ceremony & reception ───────────────────────────────────────────
  { section: "Ceremony & reception", title: "Write / choose the vows" },
  { section: "Ceremony & reception", title: "Plan the ceremony order & readings" },
  { section: "Ceremony & reception", title: "Pick ceremony music (processional, recessional)" },
  { section: "Ceremony & reception", title: "Choose the first-dance song" },
  { section: "Ceremony & reception", title: "Plan parent dances & special dances" },
  { section: "Ceremony & reception", title: "Build the reception timeline" },
  { section: "Ceremony & reception", title: "Line up toasts & speeches" },

  // ── Logistics & timeline ───────────────────────────────────────────
  { section: "Logistics & timeline", title: "Apply for the marriage license" },
  { section: "Logistics & timeline", title: "Reserve a hotel room block", category: "welcome_bags" },
  { section: "Logistics & timeline", title: "Plan the rehearsal & rehearsal dinner", category: "rehearsal_dinner" },
  { section: "Logistics & timeline", title: "Plan the honeymoon", category: "honeymoon" },
  { section: "Logistics & timeline", title: "Assemble welcome bags for out-of-town guests", category: "welcome_bags" },
  { section: "Logistics & timeline", title: "Confirm final headcount with the caterer" },
  { section: "Logistics & timeline", title: "Make final payments to vendors" },
  { section: "Logistics & timeline", title: "Share the day-of timeline with all vendors" },
  { section: "Logistics & timeline", title: "Assemble a day-of emergency kit & point person" },

  // ── After the wedding ──────────────────────────────────────────────
  { section: "After the wedding", title: "Send thank-you notes" },
  { section: "After the wedding", title: "Preserve the dress & bouquet" },
  { section: "After the wedding", title: "Leave vendor reviews & tips" },
  { section: "After the wedding", title: "Order the wedding album", category: "photographer" },
  { section: "After the wedding", title: "Handle name-change / legal paperwork" },
];

/**
 * Starter wedding-planning checklist — tailored to Andrew & Jewel's wedding
 * (Wolf Lakes Park, Fresno · April 9 2027). Compiled from the venue paperwork,
 * the vendor shortlist, and planning notes (coffee cart, "The Perfect Blend"
 * favors, invitations, registries, etc.).
 *
 * Lives in `convex/lib` so the `seedDefaults` mutation can insert it, and is
 * also imported by the admin UI for the canonical section ordering. Pure data
 * — no server-only dependencies — so it is safe to import on the client too.
 *
 * `category` (optional) is a vendor-category key from
 * `src/lib/vendor-categories.ts`. When set, the checklist row ties to the
 * vendor list: it surfaces whether a vendor in that category has been chosen,
 * and links straight to the filtered vendor view.
 *
 * `done` (optional) pre-checks an item that is already finalized.
 *
 * This list is mirrored 1:1 by the prod seed at
 * `docs/wedding-planning/prod-applied/checklist-seed-2026-06-25.jsonl`.
 * If you edit one, regenerate the other.
 */

export type ChecklistDefault = {
  section: string;
  title: string;
  /** Vendor-category key this task ties to (optional). */
  category?: string;
  /** Pre-check an already-finalized item. */
  done?: boolean;
};

/**
 * Canonical display order for sections. Items in sections not listed here are
 * appended after these, alphabetically.
 */
export const SECTION_ORDER = [
  "Venue & catering (Wolf Lakes)",
  "Vendors to finalize",
  "Decor & details",
  "Attire & beauty",
  "Paper & guests",
  "Registry & website",
  "Ceremony & reception",
  "Logistics & timeline",
  "After the wedding",
] as const;

export const CHECKLIST_DEFAULTS: ChecklistDefault[] = [
  { section: "Venue & catering (Wolf Lakes)", title: "Venue booked — Wolf Lakes Park ($16,094, 125 guests, deposit paid, contract signed)", category: "venue", done: true },
  { section: "Venue & catering (Wolf Lakes)", title: "Schedule the menu tasting with Wolf Lakes", category: "catering" },
  { section: "Venue & catering (Wolf Lakes)", title: "Choose plated menu — 4 appetizers", category: "catering" },
  { section: "Venue & catering (Wolf Lakes)", title: "Choose plated menu — 2 entrées (same for all adults)", category: "catering" },
  { section: "Venue & catering (Wolf Lakes)", title: "Choose salad, hot vegetable, and rice/potato", category: "catering" },
  { section: "Venue & catering (Wolf Lakes)", title: "Decide the bar / alcohol option (no-host vs purchase-from-venue vs BYO wine & champagne @ $12/btl corkage; beer must be through Wolf Lakes)", category: "bar" },
  { section: "Venue & catering (Wolf Lakes)", title: "Estimate guest drink counts to model the alcohol budget" },
  { section: "Venue & catering (Wolf Lakes)", title: "Decide whether to do the rehearsal dinner at The Feedlot ($48.50pp + 18% + tax, 25–80 guests)", category: "rehearsal_dinner" },
  { section: "Venue & catering (Wolf Lakes)", title: "If yes: pay The Feedlot $500 deposit + sign contract", category: "rehearsal_dinner" },
  { section: "Venue & catering (Wolf Lakes)", title: "Confirm final headcount with venue (rehearsal dinner due 3 weeks prior; balance 1 week prior)" },
  { section: "Venue & catering (Wolf Lakes)", title: "Confirm vendor insurance / COI requirements with Wolf Lakes" },
  { section: "Venue & catering (Wolf Lakes)", title: "Confirm outdoor rain / backup plan with the venue" },
  { section: "Vendors to finalize", title: "Confirm DJ — AMS Entertainment / Todd Henry (verify on Wolf Lakes required preferred-DJ list)", category: "dj_music" },
  { section: "Vendors to finalize", title: "Get quotes & choose florist (Kiku · A Secret Garden · Sweet Dreams · Sweet Memories · Awesome Blossom)", category: "florist" },
  { section: "Vendors to finalize", title: "Get quote & book the cake (Frosted Cakery · Barb's · Sweet Dreams Cakery)", category: "cake" },
  { section: "Vendors to finalize", title: "Get quote & book photographer (Hooper Photo & Film vs Franklin and Brianne)", category: "photographer" },
  { section: "Vendors to finalize", title: "Get quote & book videographer — Ironfire Studio", category: "videographer" },
  { section: "Vendors to finalize", title: "Book the photo booth (Fresno Photo Booth Co. $575/3hr vs Smiley $495)", category: "photo_booth" },
  { section: "Vendors to finalize", title: "Decide live music — Arpeggio Strings and/or Dr. Loewenheim (Fresno State) ensemble", category: "live_music" },
  { section: "Vendors to finalize", title: "Confirm rentals & decor — Maty's Linens & Decor (drapery, lights, candles, chiavari, linens)", category: "rentals" },
  { section: "Vendors to finalize", title: "Book the coffee cart (Imago Dei · Monarch Espresso · Kuppa Joy · Sunflowers & Grace)", category: "bar" },
  { section: "Vendors to finalize", title: "Choose officiant (Allen Orr · Erica Rose · Pete Hingano · Russ Counts · Thalia Arenas)", category: "officiant" },
  { section: "Vendors to finalize", title: "Book hair stylist", category: "hair" },
  { section: "Vendors to finalize", title: "Book makeup artist", category: "makeup" },
  { section: "Vendors to finalize", title: "Decide on a day-of coordinator", category: "day_of_coordinator" },
  { section: "Vendors to finalize", title: "Arrange transportation / limo (Royal Coach Limousine)", category: "transportation" },
  { section: "Decor & details", title: "Finalize ceremony decor (arch, aisle, backdrop)" },
  { section: "Decor & details", title: "Finalize reception centerpieces & floral plan" },
  { section: "Decor & details", title: "Drapery plan with Maty's" },
  { section: "Decor & details", title: "Lighting plan — lots of lights (string/uplighting)", category: "lighting_av" },
  { section: "Decor & details", title: "Candles throughout — source quantity & holders" },
  { section: "Decor & details", title: "Table settings, linens & chiavari chairs (confirm vs venue inclusions)" },
  { section: "Decor & details", title: "Signage — welcome sign, seating chart, menus, bar & coffee-cart signs" },
  { section: "Decor & details", title: "Guestbook & card / gift box" },
  { section: "Decor & details", title: "Style the cake table & sweetheart/head table" },
  { section: "Decor & details", title: "Style the coffee-cart area (tie in the coffee theme)" },
  { section: "Decor & details", title: "Decide favors — \"The Perfect Blend\" coffee favors (bags-only vs pre-filled; source beans from the coffee cart)", category: "favors" },
  { section: "Decor & details", title: "Order & assemble favors", category: "favors" },
  { section: "Decor & details", title: "Decide on a dove release (Wings Away) — optional" },
  { section: "Attire & beauty", title: "Choose & order the wedding dress", category: "bride_attire" },
  { section: "Attire & beauty", title: "Dress alterations & fittings" },
  { section: "Attire & beauty", title: "Choose the groom's suit / tuxedo", category: "groom_attire" },
  { section: "Attire & beauty", title: "Coordinate wedding-party attire (bridesmaids & groomsmen)" },
  { section: "Attire & beauty", title: "Buy the wedding rings", category: "jewelry" },
  { section: "Attire & beauty", title: "Choose accessories & shoes" },
  { section: "Attire & beauty", title: "Book a hair & makeup trial" },
  { section: "Paper & guests", title: "Finalize the guest list (~125)" },
  { section: "Paper & guests", title: "Collect guest mailing addresses" },
  { section: "Paper & guests", title: "Order & send save-the-dates" },
  { section: "Paper & guests", title: "Choose & order invitations / stationery suite", category: "stationery" },
  { section: "Paper & guests", title: "Assemble & mail invitations" },
  { section: "Paper & guests", title: "Track RSVPs (via the site)" },
  { section: "Paper & guests", title: "Build the seating chart" },
  { section: "Paper & guests", title: "Order day-of paper — programs, menus, place cards, table numbers" },
  { section: "Paper & guests", title: "Order thank-you cards" },
  { section: "Registry & website", title: "Choose registry store(s) and create the registries" },
  { section: "Registry & website", title: "Add registry links to the website" },
  { section: "Registry & website", title: "Curate registry product picks (with prices)" },
  { section: "Registry & website", title: "Finish the website (home, schedule, venue, FAQ, registry, RSVP)" },
  { section: "Registry & website", title: "Add travel & hotel info to the site" },
  { section: "Registry & website", title: "Proofread all site content" },
  { section: "Ceremony & reception", title: "Choose the wedding party (bridal party & groomsmen)" },
  { section: "Ceremony & reception", title: "Assign roles (ushers, readers, ring bearer, flower girl)" },
  { section: "Ceremony & reception", title: "Write / choose the vows" },
  { section: "Ceremony & reception", title: "Plan the ceremony order & readings" },
  { section: "Ceremony & reception", title: "Pick ceremony music (processional, recessional)" },
  { section: "Ceremony & reception", title: "Choose the first-dance song" },
  { section: "Ceremony & reception", title: "Plan parent dances & special dances" },
  { section: "Ceremony & reception", title: "Build the reception timeline" },
  { section: "Ceremony & reception", title: "Plan toasts & speeches (who & order)" },
  { section: "Ceremony & reception", title: "Decide grand entrance & exit (sparklers / send-off)" },
  { section: "Logistics & timeline", title: "Apply for the CA marriage license (within 90 days of the wedding)" },
  { section: "Logistics & timeline", title: "Reserve a hotel room block for out-of-town guests" },
  { section: "Logistics & timeline", title: "Plan guest parking & shuttle logistics" },
  { section: "Logistics & timeline", title: "Assemble welcome bags for out-of-town guests", category: "welcome_bags" },
  { section: "Logistics & timeline", title: "Plan the honeymoon", category: "honeymoon" },
  { section: "Logistics & timeline", title: "Buy gifts (wedding party, parents, each other)" },
  { section: "Logistics & timeline", title: "Share the day-of timeline & arrival times with all vendors" },
  { section: "Logistics & timeline", title: "Track & make final vendor payments (watch due dates)" },
  { section: "Logistics & timeline", title: "Assemble a day-of emergency kit" },
  { section: "Logistics & timeline", title: "Designate a day-of point person" },
  { section: "After the wedding", title: "Send thank-you notes" },
  { section: "After the wedding", title: "Return rentals / suit" },
  { section: "After the wedding", title: "Preserve the dress & bouquet" },
  { section: "After the wedding", title: "Leave vendor reviews & tips" },
  { section: "After the wedding", title: "Order the wedding album", category: "photographer" },
  { section: "After the wedding", title: "Handle name-change / legal paperwork" },
];

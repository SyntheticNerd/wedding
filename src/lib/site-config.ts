/**
 * Single source of truth for the couple's names, the wedding date, and
 * other content that's referenced across the public site and emails.
 *
 * Andrew: edit these to update the site title, hero, and email templates.
 * After this you only need to redeploy — no schema or function changes.
 */
export const COUPLE = {
  bride: "Jewel",
  groom: "Andrew",
  /** "and" word used in the title, e.g. "Andrew & Jewel" */
  joiner: "&",
} as const;

export const WEDDING = {
  /** Set to a real ISO date once locked. Used for countdown + lockedAt default. */
  dateISO: "2027-04-09" as string | null,
  /** Used as the 'lockedAt' default — RSVPs disabled after this. Set in admin settings. */
  rsvpCutoffISO: null as string | null,
  /** Display venue name on hero and footer. */
  venue: "Wolf Lakes" as string,
  /** Short city/region descriptor. */
  location: "Clovis, CA" as string,
} as const;

/**
 * App-level taxonomy for vendor records. Lives outside the Convex schema so
 * we can extend either list without a schema migration. The schema stores
 * plain strings; we trust this module to enumerate the valid values for UI
 * filters, defaults, and the bundled-row stub mapping.
 */

export const CATEGORIES = [
  "venue",
  "catering",
  "bar",
  "photographer",
  "videographer",
  "florist",
  "dj_music",
  "live_music",
  "cake",
  "hair",
  "makeup",
  "rentals",
  "lighting_av",
  "officiant",
  "transportation",
  "stationery",
  "planner",
  "day_of_coordinator",
  "bride_attire",
  "groom_attire",
  "jewelry",
  "favors",
  "tent",
  "photo_booth",
  "restrooms",
  "welcome_bags",
  "rehearsal_dinner",
  "post_wedding_brunch",
  "honeymoon",
  "other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  venue: "Venue",
  catering: "Catering",
  bar: "Bar / Beverage",
  photographer: "Photographer",
  videographer: "Videographer",
  florist: "Florist",
  dj_music: "DJ / Music",
  live_music: "Live music / Band",
  cake: "Cake & Desserts",
  hair: "Hair",
  makeup: "Makeup",
  rentals: "Rentals",
  lighting_av: "Lighting / AV",
  officiant: "Officiant",
  transportation: "Transportation",
  stationery: "Stationery & Invitations",
  planner: "Wedding planner",
  day_of_coordinator: "Day-of coordinator",
  bride_attire: "Bride attire",
  groom_attire: "Groom attire",
  jewelry: "Jewelry & Rings",
  favors: "Favors & Gifts",
  tent: "Tent",
  photo_booth: "Photo booth",
  restrooms: "Restrooms",
  welcome_bags: "Welcome bags",
  rehearsal_dinner: "Rehearsal dinner",
  post_wedding_brunch: "Post-wedding brunch",
  honeymoon: "Honeymoon",
  other: "Other",
};

export const INCLUDES = [
  "catering",
  "bar",
  "linens",
  "tables_chairs",
  "plates_glassware",
  "day_of_coordinator",
  "setup_teardown",
  "service_staff",
  "cake_cutting",
  "sound_system",
  "lighting",
  "ceremony",
  "reception",
  "rehearsal",
  "cleanup",
  "accommodation",
  "parking",
] as const;

export type IncludeTag = (typeof INCLUDES)[number];

export const INCLUDE_LABELS: Record<IncludeTag, string> = {
  catering: "Catering",
  bar: "Bar",
  linens: "Linens",
  tables_chairs: "Tables & chairs",
  plates_glassware: "Plates & glassware",
  day_of_coordinator: "Day-of coordinator",
  setup_teardown: "Setup & teardown",
  service_staff: "Service staff",
  cake_cutting: "Cake cutting",
  sound_system: "Sound system",
  lighting: "Lighting",
  ceremony: "Ceremony site",
  reception: "Reception site",
  rehearsal: "Rehearsal access",
  cleanup: "Cleanup",
  accommodation: "Accommodation",
  parking: "Parking",
};

/**
 * Categories where a vendor typically bundles other services. Only these
 * show the "What it includes" picker on the form — picking includes on a
 * photographer or florist makes no sense.
 */
export const CATEGORIES_WITH_INCLUDES = new Set<Category>([
  "venue",
  "catering",
  "bar",
  "rentals",
  "planner",
  "day_of_coordinator",
  "tent",
]);

export function categoryCanBundle(value: string): boolean {
  return CATEGORIES_WITH_INCLUDES.has(value as Category);
}

/**
 * Map an `includes` tag to a category whose section should render a
 * "covered by X" stub row when a chosen vendor's includes contains the tag.
 * Tags with no corresponding category (e.g. linens, lighting alone) return
 * undefined — they're displayed only as inline chips on the source vendor's
 * row.
 */
export const BUNDLED_TAG_TO_CATEGORY: Partial<Record<IncludeTag, Category>> = {
  catering: "catering",
  bar: "bar",
  day_of_coordinator: "day_of_coordinator",
  lighting: "lighting_av",
  sound_system: "lighting_av",
};

export function categoryLabel(value: string, customCategory?: string): string {
  if (value === "other" && customCategory?.trim()) return customCategory.trim();
  return CATEGORY_LABELS[value as Category] ?? value;
}

export function includeLabel(value: string): string {
  return INCLUDE_LABELS[value as IncludeTag] ?? value;
}

export const PRICE_UNITS = ["flat", "per_head", "per_hour"] as const;
export type PriceUnit = (typeof PRICE_UNITS)[number];

export const PRICE_UNIT_LABELS: Record<PriceUnit, string> = {
  flat: "flat",
  per_head: "per head",
  per_hour: "per hour",
};

export const STATUSES = ["considering", "chosen", "passed"] as const;
export type VendorStatus = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<VendorStatus, string> = {
  considering: "Considering",
  chosen: "Chosen",
  passed: "Passed",
};

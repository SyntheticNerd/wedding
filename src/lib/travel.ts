/**
 * Shared type + defensive parser for the Travel & Info section.
 *
 * Hotels live as a JSON array under the settings key `travel.hotels`. The
 * value comes from `v.any()` on Convex's side, so we can't trust its shape
 * at runtime. `parseHotels` accepts unknown input and returns a clean
 * array — bad entries are silently dropped (they'd only render as junk).
 */

export type PriceTier = "$" | "$$" | "$$$";

export type Hotel = {
  name: string;
  bookingUrl?: string;
  distance?: string;
  priceTier?: PriceTier;
  code?: string;
  notes?: string;
  hidden?: boolean;
};

const PRICE_TIERS: ReadonlySet<PriceTier> = new Set(["$", "$$", "$$$"]);

export function parseHotels(raw: unknown): Hotel[] {
  if (!Array.isArray(raw)) return [];
  const out: Hotel[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    if (typeof o.name !== "string" || !o.name.trim()) continue;
    const hotel: Hotel = { name: o.name.trim() };
    if (typeof o.bookingUrl === "string" && o.bookingUrl.trim()) {
      hotel.bookingUrl = o.bookingUrl.trim();
    }
    if (typeof o.distance === "string" && o.distance.trim()) {
      hotel.distance = o.distance.trim();
    }
    if (typeof o.priceTier === "string" && PRICE_TIERS.has(o.priceTier as PriceTier)) {
      hotel.priceTier = o.priceTier as PriceTier;
    }
    if (typeof o.code === "string" && o.code.trim()) {
      hotel.code = o.code.trim();
    }
    if (typeof o.notes === "string" && o.notes.trim()) {
      hotel.notes = o.notes.trim();
    }
    if (o.hidden === true) hotel.hidden = true;
    out.push(hotel);
  }
  return out;
}

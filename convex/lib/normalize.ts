import {
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";

const DEFAULT_COUNTRY: CountryCode = "US";

/**
 * Normalize a free-form phone string to E.164 (e.g. "+14155551212").
 * Returns null if the input can't be parsed as a valid number.
 */
export function normalizePhoneToE164(
  input: string | undefined | null,
  defaultCountry: CountryCode = DEFAULT_COUNTRY,
): string | null {
  if (!input) return null;
  const parsed = parsePhoneNumberFromString(input, defaultCountry);
  if (!parsed || !parsed.isValid()) return null;
  return parsed.number;
}

/**
 * Last 4 digits of a phone number, regardless of formatting.
 * Used for the public RSVP lookup ("name + last 4").
 */
export function lastFourDigits(input: string | undefined | null): string | null {
  if (!input) return null;
  const digits = input.replace(/\D/g, "");
  if (digits.length < 4) return null;
  return digits.slice(-4);
}

/**
 * Lowercase + NFD-normalize + strip diacritics + trim.
 * Used to compare names for the public RSVP lookup so "Núñez" matches "Nunez".
 */
export function nameKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/**
 * Returns true if any of the guest's name forms (first, last, aliases) match
 * the provided query (in normalized form).
 */
export function matchesAlias(
  query: string,
  guest: { firstName: string; lastName: string; aliases: string[] },
): boolean {
  const q = nameKey(query);
  if (!q) return false;
  if (nameKey(guest.firstName) === q) return true;
  if (nameKey(guest.lastName) === q) return true;
  return guest.aliases.some((alias) => nameKey(alias) === q);
}

/**
 * Generate a stable invitation ID for a household. Uses a random suffix.
 * Convex generates document IDs but invitationId is logical, not a doc id —
 * so we just produce something readable + unique.
 */
export function generateInvitationId(): string {
  const part = (n: number) =>
    Math.random().toString(36).slice(2, 2 + n).toUpperCase();
  return `INV-${part(4)}-${part(4)}`;
}

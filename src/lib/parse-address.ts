/**
 * Best-effort parser for a pasted single-string address → structured fields.
 *
 * Handles the shapes people actually paste (from Google Maps, Contacts, a
 * signature, an email): comma- and/or newline-separated, with the state and
 * ZIP usually sharing the last chunk. Returns null when it can't find a ZIP
 * (our confidence anchor) so the caller can fall back to a normal paste.
 *
 * US-focused, with a light Canada nod. City/state are best-effort; line 1 and
 * postal code are the reliable outputs.
 */

export type ParsedAddress = {
  line1: string;
  line2?: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
};

const STATE_ABBR: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR",
  california: "CA", colorado: "CO", connecticut: "CT", delaware: "DE",
  "district of columbia": "DC", florida: "FL", georgia: "GA", hawaii: "HI",
  idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS",
  kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS",
  missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM",
  "new york": "NY", "north carolina": "NC", "north dakota": "ND", ohio: "OH",
  oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI",
  "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX",
  utah: "UT", vermont: "VT", virginia: "VA", washington: "WA",
  "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
};

const STATE_CODES = new Set(Object.values(STATE_ABBR));

// US 5-digit (+4 optional) ZIP, or Canadian A1A 1A1 postal code.
const ZIP_RE = /\b(\d{5}(?:-\d{4})?|[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d)\b/;

/** Pull a trailing state (full name or 2-letter code) out of a chunk. */
function splitStateCity(chunk: string): { region: string; city: string } {
  const tokens = chunk.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { region: "", city: "" };

  // Try a full state name as the last 1–3 tokens (e.g. "New York").
  for (let n = Math.min(3, tokens.length); n >= 1; n--) {
    const candidate = tokens.slice(tokens.length - n).join(" ").toLowerCase();
    if (STATE_ABBR[candidate]) {
      return {
        region: STATE_ABBR[candidate],
        city: tokens.slice(0, tokens.length - n).join(" ").trim(),
      };
    }
  }

  // Fall back to a 2-letter state code.
  const lastTok = tokens[tokens.length - 1];
  if (/^[A-Za-z]{2}$/.test(lastTok) && STATE_CODES.has(lastTok.toUpperCase())) {
    return {
      region: lastTok.toUpperCase(),
      city: tokens.slice(0, -1).join(" ").trim(),
    };
  }

  return { region: "", city: chunk.trim() };
}

export function parseAddress(raw: string): ParsedAddress | null {
  if (!raw || !raw.trim()) return null;

  let parts = raw
    .replace(/\r/g, "")
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;

  // Pull a trailing country token if present.
  let country = "US";
  const last = parts[parts.length - 1];
  if (/^(u\.?\s?s\.?\s?a?\.?|united states(?: of america)?)$/i.test(last)) {
    country = "US";
    parts = parts.slice(0, -1);
  } else if (/^canada$/i.test(last)) {
    country = "Canada";
    parts = parts.slice(0, -1);
  }
  if (parts.length < 2) return null;

  // Locate the chunk that carries the ZIP — our anchor.
  let zi = -1;
  let postalCode = "";
  for (let i = parts.length - 1; i >= 0; i--) {
    const m = parts[i].match(ZIP_RE);
    if (m) {
      zi = i;
      postalCode = m[1].toUpperCase().replace(/\s+/g, " ");
      break;
    }
  }
  if (zi === -1) return null; // no ZIP → not confident enough; let paste pass through

  const remainder = parts[zi].replace(ZIP_RE, "").trim().replace(/\s{2,}/g, " ");

  let region = "";
  let city = "";
  let cutBeforeCity = zi; // parts[1..cutBeforeCity) are line-2 material

  if (remainder) {
    // Zip chunk also holds state (and maybe city): "Fresno CA" / "CA".
    const sc = splitStateCity(remainder);
    region = sc.region;
    if (sc.city) {
      city = sc.city;
      cutBeforeCity = zi;
    } else if (zi - 1 >= 1) {
      city = parts[zi - 1];
      cutBeforeCity = zi - 1;
    }
  } else if (zi - 1 >= 1) {
    // Zip chunk was bare ("90210"); the state may sit in the previous chunk.
    const sc = splitStateCity(parts[zi - 1]);
    region = sc.region;
    if (sc.city) {
      city = sc.city;
      cutBeforeCity = zi - 1;
    } else if (region && zi - 2 >= 1) {
      city = parts[zi - 2];
      cutBeforeCity = zi - 2;
    } else {
      city = parts[zi - 1];
      cutBeforeCity = zi - 1;
    }
  }

  const line1 = parts[0];
  if (!line1) return null;
  const line2 = parts.slice(1, cutBeforeCity).join(", ") || undefined;

  return { line1, line2, city, region, postalCode, country };
}

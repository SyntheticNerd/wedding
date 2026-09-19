/**
 * Best-effort parser for a pasted single-string address → structured fields.
 *
 * Handles the shapes people actually paste — comma-separated, newline-
 * separated, AND fully space-glued with no commas at all
 * ("752 Rustic Ranch Lane Lincoln CA 95648 US"), which is the common case
 * from Contacts / spreadsheets. Anchors on a ZIP/postal code; returns null
 * when it can't find one so the caller can fall back to a normal paste.
 *
 * When the street and city are glued with no comma, the city is recovered via
 * a street-suffix heuristic (the words after the last "St/Ave/Rd/Ct/…"). US-
 * focused, with a light Canada nod.
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

// Valid 2-letter regions: states + DC, US territories, and military "states".
const REGION_CODES = new Set([
  ...Object.values(STATE_ABBR),
  "PR", "GU", "VI", "AS", "MP", "AP", "AE", "AA",
]);

const STREET_SUFFIXES = new Set([
  "st", "street", "ave", "avenue", "blvd", "boulevard", "rd", "road", "dr",
  "drive", "ln", "lane", "ct", "court", "cir", "circle", "way", "pl", "place",
  "ter", "terr", "terrace", "pkwy", "parkway", "hwy", "highway", "sq",
  "square", "trl", "trail", "loop", "run", "path", "pike", "row", "walk",
  "cove", "bend", "point", "pt", "ridge", "pass", "plaza", "plz", "alley",
  "aly", "crossing", "xing", "manor", "grove", "glen", "landing", "spur",
  "vista",
]);

const ZIP_RE = /(\d{5}(?:-\d{4})?|[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d)/g;

function isUnitToken(t: string): boolean {
  return (
    /^#/.test(t) ||
    /^(apt|apartment|ste|suite|unit|sp|spc|space|lot|bldg|building|box|fl|floor|rm|room|no|num)\.?#?\d*[a-z]?$/i.test(
      t,
    )
  );
}

/** Pull a trailing state (full name or 2-letter code) off the end of a chunk. */
function stripTrailingState(before: string): { region: string; rest: string } {
  const s = before.replace(/[,\s]+$/, "");
  const tokens = s.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { region: "", rest: s };

  for (let n = Math.min(3, tokens.length); n >= 1; n--) {
    const cand = tokens.slice(tokens.length - n).join(" ").toLowerCase().replace(/\./g, "");
    if (STATE_ABBR[cand] && tokens.length - n >= 1) {
      return {
        region: STATE_ABBR[cand],
        rest: tokens.slice(0, tokens.length - n).join(" ").replace(/[,\s]+$/, ""),
      };
    }
  }

  const lastNorm = tokens[tokens.length - 1].replace(/[.,]/g, "").toUpperCase();
  if (/^[A-Z]{2}$/.test(lastNorm) && REGION_CODES.has(lastNorm) && tokens.length >= 2) {
    return {
      region: lastNorm,
      rest: tokens.slice(0, -1).join(" ").replace(/[,\s]+$/, ""),
    };
  }

  return { region: "", rest: s };
}

/** Split "street (+ unit) + city" into fields, comma-aware then suffix-based. */
function splitStreetCity(rest: string): {
  line1: string;
  line2?: string;
  city: string;
} {
  const commaParts = rest.split(",").map((s) => s.trim()).filter(Boolean);
  if (commaParts.length >= 2) {
    return {
      line1: commaParts[0],
      line2: commaParts.slice(1, -1).join(", ") || undefined,
      city: commaParts[commaParts.length - 1],
    };
  }

  const tokens = rest.split(/\s+/).filter(Boolean);
  let suffixIdx = -1;
  for (let i = 0; i < tokens.length; i++) {
    if (STREET_SUFFIXES.has(tokens[i].replace(/\./g, "").toLowerCase())) {
      suffixIdx = i;
    }
  }
  // No usable suffix (or it's the last token) → can't separate a city.
  if (suffixIdx === -1 || suffixIdx >= tokens.length - 1) {
    return { line1: rest, city: "" };
  }

  const streetTokens = tokens.slice(0, suffixIdx + 1);
  const cityTokens = tokens.slice(suffixIdx + 1);
  const unitTokens: string[] = [];
  // Peel leading unit markers ("#18", "sp#2", "Apt 4") into line 2.
  while (cityTokens.length > 1 && isUnitToken(cityTokens[0])) {
    const tok = cityTokens.shift() as string;
    unitTokens.push(tok);
    if (
      /^(apt|apartment|ste|suite|unit|sp|spc|space|lot|bldg|building|box|fl|floor|rm|room|no|num|#)$/i.test(
        tok,
      ) &&
      cityTokens.length > 1 &&
      /^#?\d+[a-z]?$/i.test(cityTokens[0])
    ) {
      unitTokens.push(cityTokens.shift() as string);
    }
  }

  return {
    line1: streetTokens.join(" "),
    line2: unitTokens.length ? unitTokens.join(" ") : undefined,
    city: cityTokens.join(" "),
  };
}

export function parseAddress(raw: string): ParsedAddress | null {
  if (!raw || !raw.trim()) return null;

  // Treat newlines as separators; collapse runs of whitespace.
  let s = raw.replace(/\r/g, " ").replace(/\n/g, ", ").replace(/\s{2,}/g, " ").trim();

  // Strip a trailing country token (comma- or space-attached).
  let country = "US";
  const cm = s.match(
    /[,\s]+(united states of america|united states|u\.?s\.?a\.?|usa|us|canada)\.?$/i,
  );
  if (cm && cm.index !== undefined) {
    country = /canada/i.test(cm[1]) ? "Canada" : "US";
    s = s.slice(0, cm.index).replace(/[,\s]+$/, "");
  }

  // Anchor on the LAST ZIP so a 5-digit house number at the front is ignored.
  const zips = [...s.matchAll(ZIP_RE)];
  if (zips.length === 0) return null;
  const zm = zips[zips.length - 1];
  const before = s.slice(0, zm.index).replace(/[,\s]+$/, "");
  if (!before) return null; // ZIP was the leading token (house number) — not confident

  const postalCode = zm[1].toUpperCase().replace(/\s+/g, " ");
  const { region, rest } = stripTrailingState(before);
  if (!rest) return null;

  const { line1, line2, city } = splitStreetCity(rest);
  if (!line1) return null;

  return { line1, line2, city, region, postalCode, country };
}

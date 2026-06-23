# Wedding Vendor Status — 2026-06-23

Snapshot after the Wolf Lakes confirmation + vendor cleanup/enrichment pass.
Live on andrewandjewel.com admin (Convex prod `notable-pigeon-459`).

## Counts
- **Chosen:** 1 — **Wolf Lakes Park venue @ $16,094** (plated, 125 guests, deposit paid, contract signed).
- **Considering:** 17 (the real active slate, below).
- **Passed:** 29 (alternative venues + their tied bar/catering/rental/coordinator rows — kept as research, decluttered from the considering view now the venue is locked).
- **Soft-deleted:** 3 (redundant duplicate Wolf Lakes venue/catering rows superseded by the chosen row).

## Active considering slate (17) — info completeness
All now have website/phone + a review rating except where noted. **Every custom service is
quote-only** — firm pricing needs vendor outreach (Andrew's call; represents Andrew externally).

| Category | Vendor | Rating | Price intel | Still needs |
|---|---|---|---|---|
| florist | Kiku Floral | 4.9 WW (99) | ~$3k start | quote |
| florist | A Secret Garden (Clovis — closest) | Yelp 64 / Birdeye 68 | fair/market | quote, confirm star rating |
| florist | Sweet Dreams Floral (Oakhurst ~1hr) | 4.9 WW (168) | quote; pipe&drape | quote, travel fee |
| florist | Sweet Memories Flowers (Visalia) | — | ~$5k avg | quote |
| florist | Awesome Blossom (Fresno) | 4.6 Knot (11) | quote | quote (lower rating) |
| cake | Frosted Cakery | 4.9 WW (35) | quote (high for market) | quote |
| photographer | Hooper Photo & Film | 5.0 Zola (only 2) | ~$3k–4.5k | quote (thin reviews) |
| photographer | Franklin and Brianne (Visalia) | 5.0 Birdeye (48) | quote + free planning | quote |
| videographer | Ironfire Studio | 5.0 Knot (66) | ~$3,250 start | quote (premium) |
| photo_booth | Fresno Photo Booth Company | 5.0 WW (4) | **$575/3hr confirmed** | ready to book |
| photo_booth | Smiley Photo Booths | 5.0 WW (22) | **$495 start confirmed** | ready to book |
| dj_music | AMS Entertainment (Selma) | 4.9 WW (230) | quote | **⚠️ verify on Wolf Lakes preferred-DJ list** |
| live_music | Arpeggio Strings (Fresno) | — | quote; per-musician | quote |
| live_music | Dr. Loenheim ensemble | — | — | **⚠️ not a documented for-hire ensemble — likely Dr. Thomas Loewenheim @ Fresno State; contact School of Music** |
| rentals | Maty's Linens & Decor | 5.0 WW (20) | quote; linens/draping/chiavari | quote (may overlap venue inclusions + drapery florist) |
| bar | Wolf Lakes Park Beverage Service | — | **beer/wine/champagne only, no hard liquor; billed separately** | per-person quote |
| bar | Imago Dei Coffee (mobile espresso) | — | quote; book 4–8wk ahead | quote |

## Two items needing a quick verification (not a quote)
1. **AMS Entertainment** markets Wolf Lakes weddings but is not confirmed on the venue's
   **required** preferred-DJ list — confirm with the venue before committing (DJ must come from their list).
2. **Dr. Loenheim ensemble** has no public booking presence — almost certainly Dr. Thomas
   Loewenheim (Fresno State Director of Orchestras). Decide whether to chase via Fresno State Music or drop.

## Method note (for future sessions)
All vendor writes were done with `npx convex import --replace --table vendors` using the full
table export (which includes `_id`/`_creationTime`, so Convex **preserves ids** — vendorAppointment
FKs stay valid). A full prod snapshot is taken before each write. **Never** import without `_id`
present (it would regenerate ids and orphan appointments). The `setStatus`/`softDelete` mutations
require an authenticated admin identity, so they can't be run with a bare deploy key.

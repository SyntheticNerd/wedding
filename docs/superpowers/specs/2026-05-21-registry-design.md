# Registry — Design Spec

**Date:** 2026-05-21
**Author:** Andrew (with Claude as collaborator)
**Status:** Approved — pending implementation plan

## Context

Phase 3 of the wedding site. The couple is registered on multiple retailers (Amazon, Crate & Barrel, Williams Sonoma, REI, etc.) and runs a third-party honeymoon fund (Honeyfund / Zola / Hitchd / similar). The Registry page needs to:

- Show the honeymoon fund as the page hero with a single CTA out to the third-party service.
- List the registries we're signed up for as a logo strip ("hub").
- Show a curated grid of hand-picked products pulled from those registries, with deep links to the retailer's product page.
- Support 50+ curated picks, with store and price filters, price sort, and "Load more" pagination.

Money is never handled on our side. The honeymoon fund is a link out. Per-item purchase status cannot be auto-synced — see [Auto-claim research](#auto-claim-research) below — so claiming is a manual admin toggle.

## Decisions

| Concern | Choice | Why |
|---|---|---|
| Public model | Hybrid: honeymoon fund hero + registry hub strip + curated grid | Matches the couple's intent: lead with the fund, surface the registries, browse picks |
| Payments | None on our side; CTA links out | Zero PCI surface, zero Stripe wiring |
| Honeymoon fund storage | Five keys in existing `settings` table | Single fund, link-out only — doesn't earn its own table |
| Product data source | Admin paste URL → OG/JSON-LD fetch → admin reviews/edits → save | Best ergonomics; fetch is convenience, never a gate |
| Currency | USD only | Matches rest of site; simpler indexes |
| Price | Required (`priceCents` int) | Filter + sort depend on it; price-less cards look off |
| Images | Hot-linked from retailer CDN | Zero storage, zero ops; admin replaces URL if broken |
| Claim tracking | Manual admin toggle (`claimedAt`, `claimedBy`); shown as "Already taken" badge | Auto-sync is not feasible against modern bot walls |
| Filters (public) | Store (multi-select) · Price buckets · Hide claimed | Skim-friendly on mobile; no nullable price logic |
| Categories | Not in MVP | Skipped after brainstorm; Store filter is enough |
| Sort (public) | Featured (manual) · Price low→high · Price high→low · Recently added | Featured default; manual order via drag-reorder |
| Pagination | "Load more" button (24 at a time) | Plays nicely with filter state; no scroll-jank |
| Admin reorder | Drag-handle on both registry and product lists | Friendlier than typing `displayOrder`; one-time cost |
| Soft delete | `deletedAt` on both tables | Same pattern as `guests`/`vendors` |

## Architecture

```
Public                              Admin (Clerk-gated)
┌──────────────────────────┐        ┌──────────────────────────┐
│  /registry               │        │  /admin/registries       │
│  ├─ Honeymoon hero       │        │   list · add · edit ·    │
│  ├─ Registry hub strip   │        │   reorder · soft-delete  │
│  └─ Curated grid         │        │                          │
│      filter bar          │        │  /admin/products         │
│      load-more           │        │   list · add (paste URL) │
└──────────────────────────┘        │   detail · refetch · …   │
            │                       │                          │
            │                       │  /admin/settings         │
            │                       │   honeymoonFund.* keys   │
            └──────┬────────────────┴──────────────────────────┘
                   │ Convex client (real-time)
                   ▼
            ┌─────────────────────────────────────────────┐
            │  Convex                                     │
            │  schema: registries, registryProducts,      │
            │          settings (honeymoonFund.* keys)    │
            │  queries: listRegistries, listProducts      │
            │           (filter/sort/paginate)            │
            │  mutations: CRUD + reorder + toggleClaimed  │
            │  actions:  fetchOg (Node runtime)           │
            └─────────────────────────────────────────────┘
                          │
                          ▼  outbound only
                  Retailer product pages
                  (HTTP GET for OG/JSON-LD)
```

## Public page — `/registry`

Sections, top to bottom:

1. **Hero — Honeymoon fund.** Cream-and-blush card. Headline, 1–2 line blurb, single CTA button that opens `honeymoonFund.ctaUrl` in a new tab. Hidden entirely when `honeymoonFund.enabled` is false.
2. **Hub strip — "Where we're registered."** Small logo cards, one per non-hidden registry, manual order. Each card is an anchor to the registry's landing page (`target="_blank"`, `rel="noopener"`). A registry with no `logoUrl` falls back to a typeset name card.
3. **Curated picks grid.**
   - **Filter bar** (sticky on scroll, collapses to a "Filters (N)" sheet button below `md`):
     - **Store** — multi-select chips, one per registry that has ≥1 visible product.
     - **Price** — single-select buckets: *Under $50 · $50–100 · $100–250 · $250+*.
     - **Hide claimed** — single boolean chip.
     - **Sort** — *Featured · Price low→high · Price high→low · Recently added* (default Featured).
     - **Reset** link visible only when any filter is active.
   - **Result count** under the bar: "Showing 24 of 73."
   - **Grid** — 3 cols `md+`, 2 cols `sm`, 1 col `xs`. Each card: image, name, price, source-registry chip, "Already taken" badge if claimed. Click the card → `productUrl` in new tab. Claimed cards are sorted to the end and rendered with 60% opacity.
   - **"Load more"** button at the bottom — loads next 24. State persists in URL query string so back-button works.
   - **Empty / filtered-empty state** — "Nothing matches those filters. Reset?"

Public queries are paginated via Convex's `paginate()` API on the `registryProducts` indexes; sort orientation chooses the index.

## Admin

### `/admin/registries` — the hub

- List rows: drag-handle · name · URL · "products: N" · hidden toggle · edit · delete.
- "Add registry" → sheet: name (required), url (required), logoUrl (optional), blurb (optional one-liner), hidden (bool).
- Soft-delete with confirmation. Deleting a registry that has products is allowed but warns: products keep `registryId` and stop rendering publicly until the registry is restored or the product is reassigned.
- Drag to reorder; commits `displayOrder` on drop.

### `/admin/products` — curated picks

**List view:**
- Columns: drag-handle · thumbnail · name · price · registry chip · claimed badge · hidden · actions.
- Search by name (Convex search index).
- Filter dropdown: registry · hidden state · claimed state.
- Bulk: not in MVP.

**Add product flow:**
1. Paste URL → "Fetch."
2. `fetchOg` action runs (see [OG fetcher](#og-fetcher)). Admin sees a spinner up to 8s.
3. Edit form opens, pre-filled with whatever came back. Fields:
   - **Name** (required; default from JSON-LD `name` or `og:title`)
   - **Price** (required, USD; default from JSON-LD `offers.price` or `og:price:amount`)
   - **Image URL** (required; default from JSON-LD `image[0]` or `og:image`)
   - **Product URL** (the URL you pasted)
   - **Registry** (required dropdown; default by domain match — `amazon.com` → Amazon, etc.; falls back to first registry by `displayOrder`)
   - **Hidden** (bool)
4. Save → appears in public grid.

**Detail page:**
- Same form as add, plus:
  - **Claimed toggle** — flips `claimedAt` / `claimedBy` (current user's Clerk ID).
  - **Refetch from URL** — re-runs `fetchOg`, overwrites only `ogTitle` and `ogImageUrl`, shows a per-field diff vs admin's `name`/`imageUrl`; admin clicks "Apply" per field to accept.
  - **Preview as guest** link to the live card.
  - **Soft-delete** with confirmation.

### `/admin/settings` — honeymoon fund

Adds the following fields to the existing settings page:
- **Headline** (string)
- **Blurb** (string, 1–2 lines)
- **CTA URL** (string, validated as URL)
- **CTA label** (string, default `"Contribute"`)
- **Show on registry page** (bool — `honeymoonFund.enabled`)

## Data model

### `registries`

```ts
registries: defineTable({
  name: v.string(),
  url: v.string(),
  logoUrl: v.optional(v.string()),
  blurb: v.optional(v.string()),
  displayOrder: v.number(),
  hidden: v.boolean(),
  createdAt: v.number(),
  createdBy: v.string(),
  updatedAt: v.number(),
  deletedAt: v.optional(v.number()),
}).index("by_display_order", ["deletedAt", "hidden", "displayOrder"])
```

### `registryProducts`

```ts
registryProducts: defineTable({
  registryId: v.id("registries"),
  name: v.string(),
  priceCents: v.number(),
  imageUrl: v.string(),
  productUrl: v.string(),
  displayOrder: v.number(),
  hidden: v.boolean(),
  // Claim
  claimedAt: v.optional(v.number()),
  claimedBy: v.optional(v.string()), // Clerk userId of the admin who flipped it
  // OG fetch trail
  ogFetchedAt: v.optional(v.number()),
  ogTitle: v.optional(v.string()),
  ogImageUrl: v.optional(v.string()),
  createdAt: v.number(),
  createdBy: v.string(),
  updatedAt: v.number(),
  deletedAt: v.optional(v.number()),
})
  .index("by_registry", ["registryId", "deletedAt"])
  .index("by_display_order", ["deletedAt", "hidden", "displayOrder"])
  .index("by_price", ["deletedAt", "hidden", "priceCents"])
  .searchIndex("search_name", {
    searchField: "name",
    filterFields: ["registryId", "hidden", "deletedAt"],
  })
```

### `settings` — new keys

- `honeymoonFund.headline` (string)
- `honeymoonFund.blurb` (string)
- `honeymoonFund.ctaUrl` (string)
- `honeymoonFund.ctaLabel` (string, default `"Contribute"`)
- `honeymoonFund.enabled` (boolean)

### Index strategy

- Public Featured/Recently-added sort uses `by_display_order`; price sorts use `by_price`. Store filter narrows by `registryId` via `by_registry`. At ~100 products this is bounded and fast.
- `deletedAt` first in compound indexes so soft-deleted rows are cheaply excluded.
- Claimed-vs-unclaimed isn't indexed. `hideClaimed` and "claimed sorted to end" are applied at query time alongside the chosen sort; concrete tactic (split query + concat vs. server-side post-filter with top-up) is left to the implementation plan.

## OG fetcher

Convex **action** in `convex/products.ts`, marked `"use node"`. Takes a URL string, returns `{ ok: boolean, fields: { title?, imageUrl?, priceCents? }, reason? }`.

### Extraction order
1. `<script type="application/ld+json">` Product schema → `name`, `image[0]`, `offers.price` × 100 → cents.
2. OpenGraph meta tags → `og:title`, `og:image`, `og:price:amount` × 100.
3. Microdata `itemtype="schema.org/Product"` → same fields.
4. None → return `{ ok: false, reason: "metadata_missing" }`.

Implementation uses `node-html-parser` (~30kb) to walk the DOM. No JSDOM, no headless browser.

### Network rules
- **Timeout:** 8s via `AbortController`.
- **User-Agent:** a normal browser UA string.
- **No retries.** First failure → admin fills in manually.
- **No caching.**

### Failure modes the admin sees

| Cause | Result for admin |
|---|---|
| Timeout / DNS / network error | "Couldn't reach the page — paste the details manually." Blank form, URL pre-filled. |
| HTTP 403 / 503 (bot wall — Amazon, C&B, WS often) | "Site blocked our fetch — paste the details manually." Blank form. |
| HTTP 200 but no parseable metadata | "Found the page but couldn't read product info — paste the details manually." Whatever partial fields succeeded are pre-filled. |
| Partial success | Form opens with the fields we got; missing required fields are highlighted. |
| Full success | All fields pre-filled. Admin reviews and edits. |

Every path lands the admin on the same edit form. Fetch is never a gate.

### Refetch behavior
- Overwrites only `ogTitle` and `ogImageUrl` (the retailer's current snapshot).
- Does **not** touch `name`, `imageUrl`, or `priceCents`.
- Price is not stored on the OG snapshot, so refetch never proposes a price change — admin updates price by editing the field directly.
- UI shows a per-field diff "retailer says X / you have Y" for title and image, with per-field Apply.

## Auto-claim research

A research pass in May 2026 confirmed automatic claim-syncing is not realistic for a personal wedding site:

- **Retailer APIs (Amazon PA-API, Target, C&B, Williams Sonoma, REI):** none expose registry purchase status. Amazon's PA-API is being retired 2026-05-15 and never covered registries anyway.
- **Public-page scraping:** Crate & Barrel and Williams Sonoma return 403, Amazon returns 503, Target hides product data behind a JSON blob + SPA + bot detection. The community-maintained `pariser/wedding-registry-scraper` and Apify Zola scraper are both dormant/deprecated.
- **Aggregators (Joy, Zola, Hitchd, MyRegistry, Honeyfund):** sync *inbound* (pull from retailers into their app) but expose no public outbound API. MyRegistry's API exists but is sold to retailers under a partner agreement, not personal sites.
- **Existing SaaS / OSS:** nothing maintained in 2026.

Conclusion: ship a manual claim toggle. Re-evaluate if a partner-grade API becomes available in the future.

## Aesthetic

Inherits the wedding-site tokens: cream `#FAF6F1`, blush `#E9C9C1`, sage `#9CAE9C`, charcoal `#2E2A26`. Cormorant Garamond for the hero and section headings; Inter for grid copy. Cards use a 1px `#e5ddd2` border on white, 4–6px radius. Filter chips reuse the shadcn `Badge`/`Toggle` patterns already on the admin side.

## Out of scope

- Auto-claim sync of any kind.
- Public "I bought this" button (too easy to accidentally freeze a real gift).
- Price-tracking cron or any kind of live retailer sync.
- Image proxy/storage (hot-link only).
- Categories (skipped after brainstorm).
- Multi-currency.
- Bulk add for products.
- Notifications when a product is claimed (couples-side).
- Headless-browser scraping (Puppeteer/Playwright).

## Phased build

This is Phase 3 of the wedding site. Subdivides naturally:

- **3a — Schema + admin hub.** `registries` table, `/admin/registries` CRUD, drag-reorder. No products yet.
- **3b — Products admin without OG.** `registryProducts` table, `/admin/products` CRUD with manual entry (no fetch), drag-reorder, claim toggle, refetch button stubbed.
- **3c — OG fetcher.** The `fetchOg` action + the diff-style refetch UI.
- **3d — Public page.** `/registry` route — hero, hub strip, curated grid with filters, sort, load-more.
- **3e — Honeymoon fund settings.** Five settings keys + admin form section + hero wiring.

Sub-phase order serves verification: each step is shippable, and the public page only lights up once admin can populate it.

## Implementation plan

See the corresponding plan in `docs/superpowers/plans/` once written.

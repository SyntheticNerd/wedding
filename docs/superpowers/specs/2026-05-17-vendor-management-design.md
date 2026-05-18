# Vendor Management — Design Spec

**Date:** 2026-05-17
**Author:** Andrew (with Claude as collaborator)
**Status:** Approved (pending user re-read of this file)

## Context

Andrew and his fiancée need a private, admin-only surface to organize wedding vendors — venue, catering, photographer, florist, etc. Today this lives in scattered notes and emails. The site already has a polished admin shell (Clerk-gated, Convex-backed) for guest list management; vendor tracking is the natural next module.

Phase mix: some categories are already locked in, others are still being shopped. The tool must handle "shortlist of candidates" and "chosen vendor with full details" on the same page.

Bundled services are a real concern — when the venue covers catering, bar, and linens, those line items shouldn't appear as missing decisions. The pricing model needs to surface bundling at a glance.

Andrew also wants to be able to ask Claude (in a chat session) to help front-load lists by reading and writing to the database. No built-in AI feature is in scope.

## Goals

- Track vendors per category through three states: **considering · chosen · passed**.
- Capture price, what the price includes, contact info, notes, milestones, links.
- Make bundling visible — "Sunset Manor includes catering + bar + linens" at a glance.
- Show a **committed-spend bar** with optional budget, mirroring the existing `CapacityBar`.
- Keep the schema simple and queryable so Claude can read and update it during chat sessions.
- Provide a **bulk-add form** so Claude-proposed candidates can be committed in one paste.

## Non-goals

- Built-in AI / web crawling. (Possible later if usage warrants it.)
- File uploads for contracts or brochures. URL fields only for v1.
- Per-vendor audit log. Standard `updatedAt` is enough.
- Per-user access control on vendors. Reuses the existing admin allowlist; any admin who sees guests sees vendors.
- Tracking delivered photos/videos. Out of scope.
- Spreadsheet export. Can be added later.
- Multiple competing quotes per vendor over time. The notes field carries any history.

## Decisions

| Concern | Choice | Why |
|---|---|---|
| Data model shape | Single flat `vendors` table | ~10-20 vendor candidates total; rare to need multiple quotes per vendor; cheapest to read/write for Claude in chat |
| Price model | Total + `includes[]` controlled vocabulary | Solves the bundling-display problem without forcing line-item entry |
| Categories | Fixed enum at app level (not schema) | Expand without migrations; "Other" + `customCategory` for the long tail |
| Bundling display | Show "covered by X" stub row in dependent categories | Prevents bundled services from looking like missing decisions |
| Notes | Single markdown field per vendor | Real history is rare; we don't need a journal table |
| Budget | Stored in existing `settings` table under `weddingBudget` | Mirrors how `venueCapacity` works today |
| Budget bar | Mirror `CapacityBar` — committed (filled), considering (soft band), threshold marker | Visual consistency with the guests page |
| Per-head pricing | Multiply by confirmed-RSVP count from `guests.rollups` | The only data we have; show as "est." in the row |
| Access | Reuse `(admin)` layout — same Clerk allowlist | No new auth tier needed for v1 |
| Audit | None for vendors. `updatedAt` is enough | Vendors are not legally sensitive like RSVPs |
| Soft delete | `deletedAt` field, mirrors `guests` and `messages` | Project convention |
| Research / front-load | Claude reads + writes via Convex MCP in chat; users review proposed JSON | No new infrastructure required |
| Bulk-add UX | `/admin/vendors/bulk` — textarea accepting JSON | Lets Claude hand over 5 candidates as one paste |

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  Admin (Clerk-gated) — existing (admin) layout                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  /admin/vendors          list grouped by category          │  │
│  │                          + BudgetBar at top                │  │
│  │                          + toolbar (search, filter, sort)  │  │
│  │  /admin/vendors/new      add form                          │  │
│  │  /admin/vendors/[id]     detail / edit                     │  │
│  │  /admin/vendors/bulk     paste JSON to add many at once    │  │
│  │  /admin/settings         + wedding budget input            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                            │                                     │
│                Convex client (real-time)                         │
└────────────────────────────│─────────────────────────────────────┘
                             │
                  ┌──────────▼──────────────────────────────┐
                  │  Convex                                 │
                  │  schema:    vendors (+ existing tables) │
                  │  queries:   list, byId, rollups         │
                  │  mutations: add, update, bulkAdd,       │
                  │             setStatus, softDelete       │
                  └─────────────────────────────────────────┘
```

## Data model

### `vendors` table

```ts
vendors: defineTable({
  // Identity
  name: v.string(),
  category: v.string(),                     // matches CATEGORIES constant in app code
  customCategory: v.optional(v.string()),   // freeform label when category === "other"
  status: v.union(
    v.literal("considering"),
    v.literal("chosen"),
    v.literal("passed"),
  ),

  // Money
  priceTotal: v.optional(v.number()),       // integer dollars
  priceUnit: v.optional(v.union(
    v.literal("flat"),
    v.literal("per_head"),
    v.literal("per_hour"),
  )),
  includes: v.array(v.string()),            // controlled vocabulary; see INCLUDES below

  // Contact
  contactName: v.optional(v.string()),
  phone: v.optional(v.string()),
  email: v.optional(v.string()),
  website: v.optional(v.string()),
  location: v.optional(v.string()),

  // Notes & links
  notes: v.optional(v.string()),            // markdown
  links: v.array(v.object({
    label: v.string(),
    url: v.string(),
  })),

  // Milestones (inline)
  depositAmount: v.optional(v.number()),
  depositPaidAt: v.optional(v.number()),
  finalDueAt: v.optional(v.number()),
  finalPaidAt: v.optional(v.number()),

  // Subjective
  rating: v.optional(v.number()),           // 1–5
  pros: v.optional(v.string()),
  cons: v.optional(v.string()),

  // Lifecycle
  createdAt: v.number(),
  createdBy: v.string(),                    // clerk userId
  updatedAt: v.number(),
  deletedAt: v.optional(v.number()),
})
  .index("by_category", ["category", "status"])
  .index("by_status", ["status"])
  .searchIndex("search_name", {
    searchField: "name",
    filterFields: ["category", "status", "deletedAt"],
  })
```

### App-level constants

**`CATEGORIES`** (in `src/lib/vendor-categories.ts`):

```
venue, catering, bar, photographer, videographer, florist, dj_music, live_music,
cake, hair, makeup, rentals, lighting_av, officiant, transportation, stationery,
planner, day_of_coordinator, bride_attire, groom_attire, jewelry, favors, tent,
photo_booth, restrooms, welcome_bags, rehearsal_dinner, post_wedding_brunch,
honeymoon, other
```

**`INCLUDES`** (controlled vocabulary for `vendors.includes[]`):

```
catering, bar, linens, tables_chairs, plates_glassware, day_of_coordinator,
setup_teardown, service_staff, cake_cutting, sound_system, lighting, ceremony,
reception, rehearsal, cleanup, accommodation, parking
```

Both lists ship as TypeScript const arrays so values can be expanded without a schema migration.

### `settings` — add one key

```
key:   "weddingBudget"
value: number   // integer dollars
```

Set via the existing `/admin/settings` page, identical UX to `venueCapacity`.

## Convex functions

- `vendors.list({ category?, status? })` — query, returns active (non-deleted) vendors, sorted by `category` then `name`.
- `vendors.byId(id)` — query for the detail page.
- `vendors.rollups()` — query returning `{ committed, considering, perHeadEstimate, depositsPaid, outstanding, upcoming30d }`. Used by the BudgetBar.
- `vendors.add(input)` — mutation; sets `createdAt/By`, `updatedAt`.
- `vendors.update(id, patch)` — mutation; sets `updatedAt`.
- `vendors.setStatus(id, status)` — mutation; convenience for the list page status pill.
- `vendors.bulkAdd(items[])` — mutation accepting an array; validates each, returns `{ added: number, errors: [...] }`.
- `vendors.softDelete(id)` — mutation; sets `deletedAt`.

All mutations require an authenticated admin (Clerk userId), enforced at the function level following the pattern in `convex/guests.ts`.

## UI surfaces

### `/admin/vendors` — list

- **Top:** `BudgetBar` (new component, see below).
- **Toolbar:** search input, category select, status select, sort select, "+ Add vendor" button.
- **Body:** vendors grouped by category. Each row shows category chip, name, location, includes-tags, price (with unit), status pill (color-coded).
- **Bundled-row stub:** when a `chosen` vendor's `includes[]` contains a tag mapping to another category (catering → catering category, bar → bar category), render a faded "— covered by {vendor.name} —" row in that category's section.
- Click row → navigates to detail page.

### `/admin/vendors/[id]` — detail

- Header with name, category chip, status pill, edit/delete actions.
- Sections: pricing & includes, contact, notes (markdown rendered), links, milestones, pros/cons, rating.
- Edit modal or inline edit per section.

### `/admin/vendors/new` and `/admin/vendors/bulk`

- `new` — standard form with all `vendors` fields.
- `bulk` — single textarea accepting JSON (array of objects matching `vendors.add` input). Submit calls `vendors.bulkAdd`, shows per-item success/error summary.

### `BudgetBar` component

Mirrors `src/components/admin/capacity-bar.tsx`:

- Reads `api.vendors.rollups` and `api.settings.all`.
- Shows committed (filled green band) + considering (soft band) over a denominator of `weddingBudget` or `committed + considering` if budget is unset.
- Marker line at the budget threshold when set.
- Color shifts amber at ≥90% projected, red when projected > budget.
- Status sentence: `$X committed · up to $Y if all considering chosen · $Z remaining` (last term only when budget is set).
- "Set wedding budget →" link to `/admin/settings` when unset.
- Warning sentence when projected over budget.

### Settings page addition

A new field "Wedding budget" alongside `venueCapacity`. Same input pattern.

## Admin nav

Add `Vendors` link to `src/app/(admin)/admin/layout.tsx` between `Messages` and `Settings`. Mobile abbreviation: `Vendors` (no abbreviation needed; fits).

## Research / front-loading workflow

No built-in AI. Two patterns instead:

1. **Conversational front-loading.** When Andrew asks Claude in a chat session to "help me populate caterers," Claude:
   - Reads `vendors.list({ category: "catering" })` via Convex MCP to see existing entries.
   - Proposes 3-5 candidates as a JSON array with at minimum `name`, `category`, `status: "considering"`, `website`, `location`, `notes` summarizing key facts.
   - Either writes them via `vendors.bulkAdd` directly (when Andrew says go), or hands the JSON to Andrew to paste at `/admin/vendors/bulk`.
2. **Bulk-add form.** `/admin/vendors/bulk` accepts a JSON array, validates each entry against the schema, and surfaces per-row errors so partial successes are obvious.

## Error handling

- All mutations validate inputs server-side via the `v` schema.
- `bulkAdd` returns structured results; partial failures don't roll back successful inserts.
- BudgetBar renders a skeleton while `rollups` or `settings` is `undefined`, matching `CapacityBar`.
- Per-head price estimation uses `guests.rollups().confirmed`. When no confirmed RSVPs exist yet, render the per-head row as `est. —` instead of `est. $0`.

## Testing

- Convex function tests for `vendors.rollups` covering: empty table, mixed statuses, per-head math with various RSVP counts, soft-deleted exclusion.
- Component tests for `BudgetBar` covering the three states (under budget, near, over, unset budget) — same shape as any existing capacity-bar tests.
- Smoke test for `vendors.bulkAdd` partial-error behaviour.

## Open considerations (post-MVP)

- Built-in "find candidates" via Perplexity from a Convex action.
- Paste-URL → auto-fill via OG scrape (already used for the registry product grid per the wedding-site design).
- Per-vendor file uploads (Convex storage) for signed contracts.
- Export to CSV/PDF for sharing with a planner.
- Per-user collaboration: comments / "@-mentions" between admins on a vendor.

## File / route summary

**New:**

- `convex/vendors.ts` — queries, mutations.
- `convex/schema.ts` — add `vendors` table definition.
- `src/lib/vendor-categories.ts` — `CATEGORIES`, `INCLUDES`, label helpers, `bundledTagToCategory` map.
- `src/components/admin/budget-bar.tsx`
- `src/components/admin/vendor-list.tsx`, `vendor-row.tsx`, `vendor-form.tsx`, `vendor-detail.tsx`, `vendor-bulk-form.tsx`
- `src/app/(admin)/admin/vendors/page.tsx`
- `src/app/(admin)/admin/vendors/[id]/page.tsx`
- `src/app/(admin)/admin/vendors/new/page.tsx`
- `src/app/(admin)/admin/vendors/bulk/page.tsx`

**Modified:**

- `src/app/(admin)/admin/layout.tsx` — add `Vendors` nav link.
- `src/app/(admin)/admin/settings/page.tsx` — add `weddingBudget` input. `convex/settings.ts` needs no change — generic `get`/`set`/`all` already handle the new key.

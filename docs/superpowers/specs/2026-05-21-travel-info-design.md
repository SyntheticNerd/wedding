# Travel & Info Section — Design Spec

**Date:** 2026-05-21
**Author:** Andrew (with Claude as collaborator)
**Status:** Approved — pending implementation plan

## Context

Out-of-town guests need practical info — hotels, how to get to the venue, dress code, weather, schedule. Today the site has the hero, a contact form, and the registry; there is no place for travel/info content. The venue is also still TBD (`venue: "TBD"` in `src/lib/site-config.ts`), so all this content must be editable from admin without redeploying.

The section is mostly informational, narrow in scope, and not tightly coupled to anything else. It earns no new tables — three settings keys handle it.

## Decisions

| Concern | Choice | Why |
|---|---|---|
| Placement | Section on the home page, between the hero and the contact form | No public nav yet; scroll-to-find works for a small site |
| Section label | **Travel & info** | Plain and clear; not cute |
| Content blocks at launch | Hotels · Getting here · Practical info | Picked by user; "Things to do nearby" deferred |
| Hotel storage | One `travel.hotels` settings key holding a JSON array | No schema growth; reorder by array index |
| Hotel display | Cards (1 col mobile / 2 col desktop) with name · distance · price tier · code chip · book button | Polished without committing to a table |
| "Getting here" + "Practical info" | One settings key each; plain text with paragraph breaks (`whitespace-pre-line`) | Lean; no markdown library, no sanitizer |
| Admin layout | Single page `/admin/travel` with three editable areas, one Save | Matches `/admin/settings` pattern; minimizes navigation |
| Hotel reorder (admin) | Drag-reorder via existing `@dnd-kit/sortable` | Reuses A4's `SortableList` |
| Public visibility | The whole "Travel & info" section is hidden when all three blocks are empty | Avoids a half-baked-looking section pre-launch |

## Architecture

```
Public (/)                                  Admin (/admin/travel)
┌────────────────────────────┐              ┌──────────────────────────┐
│ Hero (existing)            │              │  Hotels editor (list +   │
│ ─────────────────          │              │   repeatable form rows,  │
│ Travel & info  ◄── NEW     │              │   drag-reorder, hide)    │
│   ├ Where to stay          │              │  Getting here textarea   │
│   ├ Getting here           │              │  Practical info textarea │
│   └ Good to know           │              │  Single "Save" button    │
│ ─────────────────          │              └──────────────────────────┘
│ Contact form (existing)    │                              │
└────────────────────────────┘                              │
              │                                             │
              │ reads via api.settings.publicSettings       │
              └─────────────────────┬───────────────────────┘
                                    ▼
                            Convex `settings` table
                          (new keys: travel.hotels,
                           travel.gettingHere,
                           travel.practical)
```

## Public — home page section

Inserted between the existing `<section>` for the hero and the existing `<section>` containing `<ContactForm />` in `src/app/page.tsx`.

Heading: **Travel & info** (font-heading 3xl, centered, with a thin blush rule under it to match other section breaks).

Three sub-sections, in order:

1. **Where to stay.** Sub-heading `h3` (font-heading xl). A grid of hotel cards — 1 col below `sm`, 2 cols `sm+`. Each card:
   - Name (linked to `bookingUrl` if present; otherwise plain text), font-medium.
   - Distance label (`<10 chars`, e.g. `0.5 mi from venue`).
   - Price-tier glyph (`$`, `$$`, `$$$`).
   - Code chip ("ROOMBLOCK2026") with click-to-copy. Tiny tooltip on copy ("Copied!").
   - Optional one-line italic note.
   - "Book" button if `bookingUrl` is set.
   - Any missing optional field is omitted, not rendered empty.
   - Hidden hotels (`hidden: true`) don't render publicly.
2. **Getting here.** Sub-heading. Plain text rendered with `whitespace-pre-line` so paragraph breaks survive. Hidden if string is empty/whitespace-only.
3. **Good to know.** Same shape as Getting here. Hidden if empty.

The whole "Travel & info" section is hidden if all three blocks are effectively empty (no visible hotels, both text blocks blank).

## Admin — `/admin/travel`

One page, three areas, one Save:

### Hotels editor

A `SortableList` of repeatable hotel rows. `SortableList` expects each item to carry a stable `_id: string`. Since hotels are stored as a plain JSON array (no Convex IDs), the admin component assigns a transient client-side `_id` (`crypto.randomUUID()`) when it loads each hotel into form state, and strips that `_id` again before saving. The saved JSON contains only the persistent fields below.

Each row's fields are inline (not a sub-dialog):
- **Name** (required, text)
- **Booking URL** (text)
- **Distance** (text — e.g. "0.5 mi from venue"; free-form so the author can write "across the street" if they want)
- **Price tier** (segmented chooser: `$` · `$$` · `$$$`; clearing returns to unset)
- **Room-block code** (text)
- **Notes** (text, single-line)
- **Hidden** (toggle)
- Drag handle on the left, delete button on the right
- "Add hotel" button below the list appends a blank row

Local edits live in component state until "Save all" is pressed.

### Getting here

Multi-line textarea. Placeholder: "Nearest airport, driving directions, parking…". No character limit enforced.

### Practical info

Multi-line textarea. Placeholder: "Dress code, weather, day-of schedule…".

### Save

A single "Save changes" button at the bottom calls one mutation per settings key (`travel.hotels`, `travel.gettingHere`, `travel.practical`) via `Promise.all`, then toasts "Saved." Same pattern as `/admin/settings`.

A new nav link **Travel** in `src/components/admin/admin-nav.tsx`, between **Picks** and **Settings**, on both desktop and drawer.

## Data

All in the existing `settings` table.

### New keys

| Key | Type | Default |
|---|---|---|
| `travel.hotels` | `Hotel[]` (JSON array — see below) | `null` (treated as `[]`) |
| `travel.gettingHere` | `string` | `null` (treated as `""`) |
| `travel.practical` | `string` | `null` (treated as `""`) |

### `Hotel` shape

```ts
type Hotel = {
  name: string;             // required
  bookingUrl?: string;
  distance?: string;
  priceTier?: "$" | "$$" | "$$$";
  code?: string;
  notes?: string;
  hidden?: boolean;
};
```

Stored as a `v.any()` value in the settings row (the existing `settings.set` mutation already accepts `v.any()`).

### Validation

A new admin mutation `settings.setTravelHotels` (or just reuse `settings.set` with light client-side validation) validates that:
- Value is an array of objects
- Every object has a non-empty `name` string
- `priceTier`, if present, is `$`, `$$`, or `$$$`
- Other fields, if present, are strings or `boolean`

Bad entries are dropped (logged once) rather than failing the entire save. The admin form's own validation should catch this before the mutation in the common case.

### PUBLIC_KEYS

Add all three to the `PUBLIC_KEYS` set in `convex/settings.ts` so `publicSettings` exposes them to the home page.

## Aesthetic

Inherits site tokens: cream `#FAF6F1` background, blush `#E9C9C1` accents, charcoal `#2E2A26` text. Cormorant Garamond for headings, Inter for body. Hotel cards reuse the `bg-card border border-border rounded-md` treatment from the registry grid for consistency. Code chip uses the existing `Badge` primitive with a subtle hover state to hint clickability.

## Out of scope

- Things to do nearby (deferred — picked-and-skipped at brainstorm time).
- Markdown rendering. Plain text + paragraph breaks only. Revisit if the couple wants bullet lists or bold without escaping.
- Map embed (Google/Mapbox) — adds API-key infrastructure and isn't necessary when the venue address can just be in a link.
- Schedule as a structured table — schedule lives inside the "Practical info" text block for MVP.
- Per-hotel image upload — text-only.
- Multi-language.
- Public nav row.

## Phased build

This is a single, cohesive feature with no internal hard ordering. Suggested order for the plan:

1. **T1** — Add the three keys to `PUBLIC_KEYS` in `convex/settings.ts`.
2. **T2** — Build the public components (`travel-section.tsx`, `hotel-card.tsx`) reading from `api.settings.publicSettings`; mount in `src/app/page.tsx` between hero and contact form.
3. **T3** — Build the admin page (`/admin/travel`) — hotels list + two textareas + Save; reuses `SortableList`.
4. **T4** — Add the "Travel" admin nav link.
5. **T5** — Smoke pass (typecheck, lint, headed-browser).

## Implementation plan

See the corresponding plan in `docs/superpowers/plans/` once written.

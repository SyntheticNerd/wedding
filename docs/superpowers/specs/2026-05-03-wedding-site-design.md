# Wedding Site — Design Spec

**Date:** 2026-05-03
**Author:** Andrew (with Claude as collaborator)
**Status:** Approved — implementation in progress

## Context

Personal wedding website for Andrew + fiancée and ~150 guests. Two surfaces:

- **Public** — guests find event info (story, schedule, venue, registry, FAQ) and submit RSVPs.
- **Admin** — couple + ~5 trusted family/friends manage the guest list, view RSVPs, run the registry.

Andrew + fiancée want to start managing the guest list immediately, well before the public site is polished. The wedding is 2–6 months out.

## Decisions

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js 16 App Router, TypeScript strict | Andrew already runs Next.js in `~/code/budget-app`; Vercel-native |
| Database | Convex (free tier) | Type-safe end-to-end, generous quota, native Vercel story, real-time queries available if we want them |
| Admin auth | Clerk (magic-link email, allowlisted) | Smallest wiring for ~5-user admin; per-user audit trails for free; Convex+Clerk is well-trodden |
| Notifications | Resend on RSVP submit + edit | 3k/mo free tier covers a wedding many times over; per-admin opt-in |
| Hosting | Vercel (Fluid Compute) | Andrew's account is already linked |
| Styling | Tailwind + shadcn/ui (themed) | Fast, accessible primitives; theme via design tokens |
| Guest auth | Lookup-only — name + last-4-of-phone | Defeats casual mischief without SMS infra; avoids publishing a guest list |
| Plus-ones | Server-enforced boolean per guest | Prevents the "I brought 3 people" failure |
| Household model | One record per person, grouped by `invitationId` | Allows split RSVP within a household as a first-class state |
| State changes | Append-only audit log; current state is a projection | Real wedding sites need "who changed what when" |
| Registry | Cards → external sites + unified product grid → deep-link to product pages | One unified browsing surface; lean on each registry's native availability |
| Aesthetic | Warm minimal — cream/blush/sage, Cormorant Garamond + Inter | Tasteful default; tokens make swaps easy |
| Deferred | Meal selection, event-day photo upload | Out of scope for MVP |
| Rejected | Public scrollable guest list, claim-tracking on registry items | Privacy + reliability |

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  Public                                  Admin (Clerk-gated)      │
│  ┌────────────┐  ┌────────────┐         ┌──────────────────────┐ │
│  │  Home      │  │  /rsvp     │         │  /admin              │ │
│  │  Story     │  │  lookup    │         │  guest list + filter │ │
│  │  Schedule  │  │  + form    │         │  /guests/[id]        │ │
│  │  Venue     │  │            │         │  /import (CSV)       │ │
│  │  Registry  │  │            │         │  /registries         │ │
│  │  FAQ       │  │            │         │  /products (URL → OG)│ │
│  └────────────┘  └────────────┘         │  /settings           │ │
│        │              │                 └──────────────────────┘ │
│        └──────────────┴─────────────────────────────│            │
│                       Convex client (real-time)     │            │
└──────────────────────────────────────────────────────│────────────┘
                                                      │
                          ┌───────────────────────────▼─────────────┐
                          │  Convex                                 │
                          │  schema: guests, rsvpAuditLog,          │
                          │          settings, adminProfiles,       │
                          │          registries, products, pages    │
                          │  functions: queries (read), mutations   │
                          │             (write + audit), actions    │
                          │             (Resend, OG fetch)          │
                          └─────────────────────────────────────────┘
                                            │
                                            ▼
                                     Resend (transactional email)
                                     Clerk (auth → JWT to Convex)
```

## Data model (key tables)

**`guests`** — one record per person.
- Identity: `firstName`, `lastName`, `aliases[]` (nicknames, maiden names), `phoneE164`, `email`, `address`.
- Grouping: `invitationId` (groups households), `side` (bride/groom/both), `isChild`.
- RSVP: `rsvpStatus` (pending/yes/no), `rsvpAt`, `rsvpOffline` (admin marks "they'll RSVP by phone").
- Plus-one: `plusOneAllowed`, `plusOneName?`, `plusOneRsvp?`.
- Soft data: `dietaryNotes?`, `noteToCouple?`, `adminNotes?`.
- Lifecycle: `createdAt`, `createdBy`, `updatedAt`, `deletedAt?` (soft delete).

**`rsvpAuditLog`** — append-only.
- `guestId`, `invitationId`, `changedAt`, `changedBy` (guest/admin), `changedByUserId?`, `before`, `after`.

**`settings`** — kv: `weddingDate`, `lockedAt`, `coupleNames`, etc.

**`adminProfiles`** — `clerkUserId`, `displayName`, `emailNotificationsEnabled`.

**`registries`** — `name`, `url`, `logoUrl?`, `blurb?`, `displayOrder`, `hidden`.

**`products`** — `registryId`, `name`, `priceCents?`, `currency`, `imageUrl?`, `productUrl`, `displayOrder`, `hidden`.

## Public RSVP flow

1. Guest visits `/rsvp`.
2. Types first name, last name, last-4-of-phone.
3. Server normalizes: lowercase + NFD-strip diacritics on names; matches against `firstName`, `lastName`, and `aliases[]`. Filters to phones ending in those 4 digits.
4. 0 matches → friendly error ("Couldn't find you — text Andrew at TBD").
5. 1 match → continue.
6. >1 match → chooser using last-2-of-postal-code as disambiguator.
7. Guest sees their RSVP form: yes/no, plus-one yes/no (only if `plusOneAllowed`), plus-one name (optional), dietary notes, note to couple.
8. Submit → mutation:
   - Validates `lockedAt` cutoff (read-only message if past).
   - Updates guest record.
   - Appends audit row (`changedBy: "guest"`).
   - Triggers `notifyAdminsOfRsvp` action → Resend → emails each admin with `emailNotificationsEnabled: true`.

## Admin features

- **List view** with rollup chips (Total · Bride · Groom · Both · Yes · No · Pending · Plus-ones · Headcount), search, side/status filters, color-coded status badges, click-into detail.
- **Detail view** with full edit form, audit history accordion, soft-delete.
- **CSV import** (preview + commit) and CSV export.
- **Settings:** couple names, wedding date, `lockedAt`, per-admin notification toggle.
- **Registry admin:** drag-reorder registries, paste-URL product flow with Open Graph metadata fetch.

## Aesthetic direction

- **Palette:** cream `#FAF6F1`, blush `#E9C9C1`, sage `#9CAE9C`, charcoal `#2E2A26`, soft-white `#FFFFFF`.
- **Type:** Cormorant Garamond (display) + Inter (body), via `next/font/google`.
- **Tone:** photo-forward, generous whitespace, subtle blush accents on calls-to-action, sage for confirmations.
- **One source of truth:** `src/lib/design-tokens.ts` — palette swap = one file edit.

## Phased build

- **Phase 1** — Admin foundation + guest list (priority — couple starts immediately).
- **Phase 2** — Public RSVP + email notifications.
- **Phase 3** — Registry (admin URL-paste flow + public unified grid).
- **Phase 4** — Static sections + polish + accessibility/perf passes.

## Out of scope (explicitly)

- Meal selection, event-day photo upload, guest-to-guest features, internationalization, separate mobile app, public guest list scrolling, claim-tracking on registry items.

## Implementation plan

See `docs/superpowers/plans/2026-05-03-implementation-plan.md` for the full execution plan, file map, vendor setup steps, and verification checklists.

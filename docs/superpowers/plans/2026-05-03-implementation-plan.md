# Wedding Site — Implementation Plan

## Context

Andrew is building a personal wedding site for ~150 guests, hosted on Vercel. The site has two surfaces:

- **Public:** invitation experience for guests — story, schedule, venue, registry, FAQ — and a private RSVP flow.
- **Admin:** guest-list management for ~5 trusted people (Andrew, fiancée, possibly parents) — color-coded RSVP table, per-guest detail editing, side rollups, CSV export, audit log.

The need: Andrew + fiancée want to start managing the guest list **immediately**, well before the public site is polished. So the build is phased — admin tooling first, public RSVP next, then registry, then static content.

This plan was written following a brainstorming session on 2026-05-03 where the stack, RSVP flow, registry mechanics, notifications model, and admin-auth approach were all locked in. Andrew has authorized "vibe-codey, hands-off, hackathon yolo" execution after this plan is approved.

Repo: `git@github.com:SyntheticNerd/wedding.git` (currently empty on remote).

---

## Decisions locked in (brainstorming, 2026-05-03)

| Decision | Choice |
|---|---|
| Framework | Next.js 16 App Router, TypeScript strict, Turbopack |
| Database | Convex (free tier, type-safe, generous quota) |
| Admin auth | Clerk (magic-link email, allowlist of admin emails) |
| Notifications | Resend on RSVP submit + edit (email all admins, per-admin opt-in) |
| Hosting | Vercel (Fluid Compute, default region) |
| Styling | Tailwind CSS + shadcn/ui (themed) |
| Guest auth | Lookup-only — name + last-4-of-phone (no public scrollable list) |
| Plus-ones | Server-enforced boolean per guest; optional plus-one name |
| Household model | One record per person, grouped by `invitationId` |
| State changes | Append-only audit log; current state is a projection |
| Registry | Card grid → external sites + unified product grid → deep-link to product pages on each registry. No claim system. URL-paste admin flow with Open Graph metadata fetch. |
| Aesthetic | Warm minimal — cream/blush/sage palette, serif display (Cormorant Garamond), sans body (Inter). Photo-forward, lots of whitespace. (Adjustable via single design-tokens file.) |
| Deferred | Meal selection, photo uploads during the event |

Wedding date, fiancée's name, and the full admin allowlist are wired through one constants file Andrew can edit at any time (no code re-deploy needed for Clerk allowlist — that's set in the Clerk dashboard).

---

## Phased build

Each phase ends with a Vercel preview deploy, a PR opened against `main`, type-check/lint clean, and verification via Chrome DevTools MCP. Andrew reviews preview URL between phases.

### Phase 1 — Admin Foundation + Guest List **(priority)**

Goal: Andrew + fiancée can log in tomorrow and start entering guests.

**Scaffolding:**
- `pnpm create next-app@latest` with TypeScript, Tailwind, App Router, src/, ESLint, no Turbopack-disable.
- Add `convex`, `@clerk/nextjs`, `@clerk/clerk-sdk-node`, `resend`, `lucide-react`, `clsx`, `class-variance-authority`, `tailwind-merge`, `zod`, `react-hook-form`, `@hookform/resolvers`.
- shadcn/ui init with custom theme matching the cream/blush/sage palette.
- `convex/` directory; `npx convex dev` initializes the deployment (Andrew runs once locally; see "what Andrew does" below).
- Clerk middleware gating `/admin/**` to allowlisted users.

**Convex schema (`convex/schema.ts`):**
```ts
guests: defineTable({
  // identity
  firstName: v.string(),
  lastName: v.string(),
  aliases: v.array(v.string()),       // nicknames, maiden names
  phoneE164: v.optional(v.string()),  // normalized E.164
  email: v.optional(v.string()),
  address: v.optional(v.object({
    line1: v.string(),
    line2: v.optional(v.string()),
    city: v.string(),
    region: v.string(),
    postalCode: v.string(),
    country: v.string(),
  })),
  // grouping & metadata
  invitationId: v.string(),           // groups households
  side: v.union(v.literal("bride"), v.literal("groom"), v.literal("both")),
  isChild: v.boolean(),
  // RSVP
  rsvpStatus: v.union(v.literal("pending"), v.literal("yes"), v.literal("no")),
  rsvpAt: v.optional(v.number()),
  rsvpOffline: v.boolean(),           // admin marks "they'll RSVP by phone"
  // plus-one
  plusOneAllowed: v.boolean(),
  plusOneName: v.optional(v.string()),
  plusOneRsvp: v.optional(v.union(v.literal("yes"), v.literal("no"))),
  // soft data
  dietaryNotes: v.optional(v.string()),
  noteToCouple: v.optional(v.string()),
  adminNotes: v.optional(v.string()),
  // lifecycle
  createdAt: v.number(),
  createdBy: v.string(),              // Clerk userId
  updatedAt: v.number(),
  deletedAt: v.optional(v.number()),  // soft delete
}).index("by_lastName", ["lastName", "firstName"])
  .index("by_invitation", ["invitationId"])
  .index("by_side", ["side"])
  .index("by_phone", ["phoneE164"]),

rsvpAuditLog: defineTable({
  guestId: v.id("guests"),
  invitationId: v.string(),
  changedAt: v.number(),
  changedBy: v.union(v.literal("guest"), v.literal("admin")),
  changedByUserId: v.optional(v.string()),  // Clerk userId if admin
  before: v.any(),
  after: v.any(),
}).index("by_guest", ["guestId", "changedAt"]),

settings: defineTable({
  key: v.string(),                    // e.g. "lockedAt", "weddingDate", "coupleNames"
  value: v.any(),
  updatedAt: v.number(),
  updatedBy: v.string(),
}).index("by_key", ["key"]),

adminProfiles: defineTable({
  clerkUserId: v.string(),
  displayName: v.string(),
  emailNotificationsEnabled: v.boolean(),
}).index("by_clerk_user", ["clerkUserId"]),
```

**Convex functions (`convex/guests.ts`):**
- `list({ side?, search?, status?, includeDeleted? })` — admin query, returns sorted, filtered guests with rollups.
- `get({ id })` — admin query.
- `create({ ...fields })` — admin mutation; generates `invitationId` if not provided.
- `update({ id, ...fields })` — admin mutation; appends audit row if `rsvpStatus` or `plusOneRsvp` changed.
- `softDelete({ id })` — admin mutation.
- `bulkImport({ csv })` — admin mutation that parses CSV and creates many.
- `rollups()` — admin query: `{ total, bride, groom, both, yes, no, pending, plusOnes, attending }`.
- `auditFor({ guestId })` — admin query.

**Convex helpers (`convex/lib/normalize.ts`):**
- `normalizePhoneToE164(input, defaultCountry = "US")` — strips formatting, adds country code, validates with `libphonenumber-js`.
- `nameKey(firstName, lastName)` — lowercases + NFD-normalizes + strips diacritics + trims.
- `matchesAlias(query, guest)` — checks against firstName, lastName, and aliases array.

**Routes:**
- `src/middleware.ts` — Clerk middleware gating `/admin/**`.
- `src/app/admin/layout.tsx` — admin chrome (header w/ user menu, signed-in guard).
- `src/app/admin/page.tsx` — guest list table.
  - Columns: Name | Side | Invitation | RSVP | Plus-one | Last updated.
  - Color coding: pending=neutral, yes=sage, no=rose, offline=amber.
  - Filters: side (all/bride/groom/both), status, search.
  - Actions: add guest (drawer), bulk import (modal), CSV export (button), open detail.
  - Rollup chips above the table: Total · Bride · Groom · Both · Yes · No · Pending · Plus-ones · Headcount.
- `src/app/admin/guests/[id]/page.tsx` — full edit form, audit history accordion, "delete" action (soft delete).
- `src/app/admin/guests/new/page.tsx` — add-guest form (or drawer from list page).
- `src/app/admin/import/page.tsx` — CSV bulk import with preview + confirm.
- `src/app/admin/settings/page.tsx` — couple names, wedding date, locked-at, per-admin notification toggle.

**UI primitives (shadcn/ui):**
- `button`, `input`, `select`, `dialog`, `drawer`, `dropdown-menu`, `table`, `badge`, `tabs`, `form`, `toast`, `command` (for search), `accordion`.

**No public site yet** in Phase 1 — root path shows a "Coming soon" placeholder with the couple's names so the URL works.

**Phase 1 verification (after deploy to Vercel preview):**
- Sign in via Clerk magic link as Andrew → land on `/admin`.
- Add a test guest with all fields, including E.164 normalization (paste a US number with parens — should normalize).
- Edit the guest, flip RSVP yes → no — confirm audit log row appears.
- Filter by side, search by partial name + alias, sort.
- CSV export → open in spreadsheet.
- Bulk import a sample CSV → preview → confirm.
- Sign out → confirm `/admin` redirects to sign-in.

---

### Phase 2 — Public RSVP + Email notifications

**Public route `/rsvp`:**
- Single-screen lookup form: first name, last name, last-4-of-phone.
- On submit: server-side `findGuestForRsvp` query.
  - Normalizes name (lowercase, strip diacritics).
  - Matches against `firstName`, `lastName`, and `aliases`.
  - Filters to phones ending in the supplied 4 digits.
  - If 0 matches: friendly error ("Couldn't find you — text Andrew at TBD").
  - If 1 match: continue to RSVP form.
  - If >1 match: chooser UI with last-2-of-address-postal-code as disambiguator.
- RSVP form: yes/no, plus-one yes/no (only if `plusOneAllowed`), plus-one name (optional), dietary notes, note to couple.
- Submit → `submitRsvp` mutation:
  - Validates `lockedAt` cutoff.
  - Updates guest record.
  - Appends audit row (`changedBy: "guest"`).
  - Triggers `notifyAdminsOfRsvp` action.

**Notifications (Convex action calling Resend):**
- `sendRsvpNotification` — runs on RSVP create/edit.
- Reads admin profiles, filters to those with `emailNotificationsEnabled: true`.
- Sends a single email per admin: subject "RSVP from {Guest Name}", body with name, status, plus-one, dietary, note, and a link to the admin guest detail.

**Public homepage placeholder gets a real RSVP button** linking to `/rsvp`.

**Phase 2 verification:**
- Sign out, navigate to `/rsvp`, RSVP as a test guest → confirm RSVP recorded, audit row appended, email received.
- Try invalid phone digits → friendly error.
- Try duplicate name → chooser UI works.
- Try RSVP after `lockedAt` → read-only message.

---

### Phase 3 — Registry

**Convex schema additions:**
```ts
registries: defineTable({
  name: v.string(),
  url: v.string(),
  logoUrl: v.optional(v.string()),
  blurb: v.optional(v.string()),
  displayOrder: v.number(),
  hidden: v.boolean(),
}),

products: defineTable({
  registryId: v.id("registries"),
  name: v.string(),
  priceCents: v.optional(v.number()),
  currency: v.string(),               // "USD" default
  imageUrl: v.optional(v.string()),
  productUrl: v.string(),             // deep link to product on registry site
  description: v.optional(v.string()),
  displayOrder: v.number(),
  hidden: v.boolean(),
}).index("by_registry", ["registryId", "displayOrder"]),
```

**Admin routes:**
- `src/app/admin/registries/page.tsx` — list, drag-reorder, add/edit/hide.
- `src/app/admin/products/page.tsx` — list across all registries with registry filter.
- `src/app/admin/products/new/page.tsx` — paste-URL flow:
  1. Paste product URL → server fetches Open Graph (`og:title`, `og:image`, `og:price:amount`).
  2. Pre-fills name, image URL, price.
  3. Andrew confirms / picks registry / saves.
  - Server-side OG fetch via a Next.js Route Handler `app/api/admin/scrape/route.ts`. Use `node-html-parser` or `cheerio` to parse meta tags. 5-second timeout, fail gracefully (admin can fill manually).

**Public routes:**
- `src/app/registry/page.tsx`:
  - Top: registry cards grid. Each card → external registry URL in new tab.
  - Bottom: unified product grid sorted by `displayOrder`. Each card has photo, name, price, "from {registry name}" label, and a "View on {registry}" button that opens `productUrl` in a new tab.
- Filter chip row above the product grid: "All" + one chip per registry (toggle).

**Phase 3 verification:**
- Add a registry, add 3 products via URL-paste → confirm OG fetch works on Amazon, Crate & Barrel, and a generic URL.
- Hide a product → confirm public grid hides it.
- Reorder products → confirm public grid reflects order.
- Click "View on {registry}" → confirm opens deep-link in new tab.

---

### Phase 4 — Static sections + polish

**Routes:**
- `src/app/page.tsx` — homepage (hero with photo + names + date + countdown, scroll to sections, RSVP CTA).
- `src/app/our-story/page.tsx` — long-form layout with section breaks for photos.
- `src/app/schedule/page.tsx` — timeline of events: ceremony, cocktail hour, reception, after-party (if any). Each entry: time, location, dress code, notes.
- `src/app/venue/page.tsx` — venue info, map embed, getting there (parking, hotels, transit).
- `src/app/catering/page.tsx` — vendor name, menu highlights, "let us know dietary needs in your RSVP".
- `src/app/faq/page.tsx` — accordion of common questions (dress code, kids, gifts, photos).
- `src/app/gallery/page.tsx` — engagement photos grid (Convex file storage if Andrew uploads, or Cloudinary if he prefers; defer the choice — Convex storage is fine for MVP).

**Content storage:**
- A small `pages` table in Convex for rich-text page bodies (`our-story`, `venue`, `catering`, etc.) so Andrew can edit copy from the admin UI without redeploying. Use `react-textarea-autosize` + a markdown renderer (e.g. `react-markdown`).

**Aesthetic polish:**
- Final design pass on shared header/footer, type scale, spacing rhythm, photo treatments.
- Accessibility audit (Lighthouse 90+ on home, RSVP, registry).
- Lighthouse perf > 90 on every public page.
- OpenGraph + Twitter card meta tags.
- Custom 404.

**Phase 4 verification:**
- Lighthouse audit on every public page.
- Accessibility: keyboard navigation, focus states, alt text, color contrast.
- Mobile (iPhone 13 / Pixel 5 viewports via Chrome DevTools MCP).
- Real-content sanity check (ask Andrew to fill copy via admin → confirm renders correctly).

---

## Cross-cutting design

### Audit log
- Every mutation that changes RSVP state or plus-one fields appends to `rsvpAuditLog`.
- Admin guest detail page shows the log in an accordion ("History").
- `before` / `after` are JSON snapshots of the changed fields only — keeps the log small.

### Locking the list
- Setting `lockedAt` (admin settings page) flips the public RSVP flow into read-only mode after that date.
- Admin can still edit any guest after lock (with audit log marking `changedBy: "admin"`).

### Side rollups
- `rollups()` query computed server-side via Convex aggregations. Cached for 60s in admin UI.

### Soft delete
- Guests are soft-deleted (`deletedAt`). Admin can still see deleted guests (settings toggle) and restore.

### Aesthetic defaults (single source of truth)
- `src/lib/design-tokens.ts` exports color/font/space scale.
- Tailwind config consumes the tokens.
- Andrew can swap palette by editing one file.
- Initial palette:
  - Cream `#FAF6F1`, Blush `#E9C9C1`, Sage `#9CAE9C`, Charcoal `#2E2A26`, Soft white `#FFFFFF`.
  - Display font: Cormorant Garamond. Body: Inter. Loaded via `next/font/google`.

---

## File map (Phase 1 critical files)

```
wedding/
├── package.json
├── pnpm-lock.yaml
├── next.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.mjs
├── components.json                    # shadcn config
├── eslint.config.mjs
├── .env.example                       # required env vars (no secrets)
├── vercel.json                        # minimal — most config inferred
├── README.md
├── CLAUDE.md                          # already exists
├── docs/
│   └── superpowers/
│       └── specs/
│           └── 2026-05-03-wedding-site-design.md   # written after plan approval
├── convex/
│   ├── _generated/                    # auto
│   ├── schema.ts
│   ├── auth.config.ts                 # Clerk integration
│   ├── guests.ts                      # CRUD + queries
│   ├── audit.ts                       # audit log helpers
│   ├── settings.ts                    # couple names, lockedAt
│   ├── adminProfiles.ts               # per-admin notification prefs
│   ├── notifications.ts               # Resend action
│   └── lib/
│       ├── normalize.ts               # phone E.164, name keys
│       └── csv.ts                     # parser/exporter
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # ConvexProvider + ClerkProvider
│   │   ├── page.tsx                   # placeholder home
│   │   ├── globals.css
│   │   ├── (admin)/
│   │   │   └── admin/
│   │   │       ├── layout.tsx         # signed-in guard, chrome
│   │   │       ├── page.tsx           # guest list
│   │   │       ├── guests/
│   │   │       │   ├── new/page.tsx
│   │   │       │   └── [id]/page.tsx
│   │   │       ├── import/page.tsx
│   │   │       └── settings/page.tsx
│   │   ├── sign-in/[[...sign-in]]/page.tsx
│   │   └── api/
│   │       └── (none in Phase 1)
│   ├── components/
│   │   ├── ui/                        # shadcn primitives
│   │   ├── admin/
│   │   │   ├── guest-table.tsx
│   │   │   ├── guest-form.tsx
│   │   │   ├── rollup-chips.tsx
│   │   │   ├── side-filter.tsx
│   │   │   ├── audit-log.tsx
│   │   │   └── csv-import-dialog.tsx
│   │   └── shared/
│   │       └── site-header.tsx
│   ├── lib/
│   │   ├── design-tokens.ts
│   │   ├── utils.ts                   # cn() helper
│   │   ├── phone.ts                   # client-side phone helpers
│   │   └── csv.ts                     # client CSV helpers
│   ├── hooks/
│   │   └── use-rollups.ts
│   └── middleware.ts                  # Clerk middleware
└── .claude/                            # already scaffolded
    ├── settings.json
    ├── settings.local.json
    └── hooks/
        └── stop-check.sh
```

---

## What Andrew needs to do (one-time vendor setup)

You need to create accounts on three free services. ~10 minutes total. I'll handle everything in the code — you just need to provision accounts and paste the keys back here (or into Vercel env vars directly).

### 1. Convex (~3 min)
- Sign up at https://convex.dev (Google sign-in works).
- After scaffolding lands, run from `~/code/wedding`:
  ```
  npx convex dev
  ```
- It'll prompt: "Create a new project" → name it `wedding` → done. Convex writes the dev deployment URL to `.env.local` automatically.
- For production: `npx convex deploy` once, then set `CONVEX_DEPLOY_KEY` and `NEXT_PUBLIC_CONVEX_URL` in Vercel. I'll script this when we're ready to deploy Phase 1 to production.

### 2. Clerk (~3 min)
- Sign up at https://clerk.com.
- Create a new application → name `Wedding Admin`.
- Authentication: turn on **Email magic link**, turn off everything else.
- Restrictions → Allowlist → add your + fiancée's emails (and anyone else who needs admin access).
- Copy these and paste into Vercel env vars (or send to me):
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - `CLERK_SECRET_KEY`
  - `CLERK_WEBHOOK_SECRET` (after we set up webhooks for the Convex bridge)

### 3. Resend (~3 min)
- Sign up at https://resend.com.
- Settings → API Keys → create one with full access → name `wedding-prod`.
- Optional: add a sending domain (e.g. `mail.yourdomain.com`) — if you skip this, emails will come from `onboarding@resend.dev` which is fine for testing but flagged as spam by some clients. Recommended for production.
- Paste `RESEND_API_KEY` into Vercel env vars.

### Vercel
- Link the local repo to your existing Vercel project (or create one): `vercel link` from `~/code/wedding`.
- Set the env vars above via `vercel env add`.

### Things you should tell me when convenient (non-blocking)
- Wedding date (so I can wire `lockedAt` defaults).
- Fiancée's first name (for site title — "Andrew & ___").
- Custom domain (or use `wedding-andrew.vercel.app`).

I'll start with placeholders for these and you can change one constants file when you have them.

---

## Workflow during execution

- **Branching:** Each phase gets its own branch (e.g. `phase-1-admin-foundation`). Work happens on the branch, frequent commits with `wip:` prefix, squash on merge.
- **PR per phase:** When a phase passes verification, I open a PR and post the Vercel preview URL. Andrew reviews & merges.
- **Issues for follow-ups:** Anything found during verification that's not blocking gets filed as a GitHub issue (label `polish` or `bug`), not crammed into the PR.
- **Commits include plans/notes:** As Andrew requested, the design doc, plan file (this file via `~/.claude/plans/...` is symlinked or copied into `docs/superpowers/plans/` on commit), and notes are all committed alongside code. Env vars (`.env.local`, etc.) are gitignored.
- **Convex schema migrations:** Any schema change is paired with a migration mutation in `convex/migrations/` so deploys don't break.
- **Type-check + lint clean** before any commit. The Stop hook nudges if uncommitted changes are open at session end.
- **Verification before each PR:** Chrome DevTools MCP for browser-driven smoke tests; manual screenshot review on the Vercel preview.

---

## Verification (master)

End-to-end after Phase 1:
1. `pnpm dev` boots cleanly with no console errors.
2. `pnpm typecheck` (alias for `tsc --noEmit`) passes.
3. `pnpm lint` passes.
4. `npx convex dev` shows schema validates.
5. Vercel preview URL loads, sign-in flows end-to-end, guest CRUD round-trips, audit log accumulates rows.
6. CSV export round-trips through bulk import.
7. Lighthouse on `/admin` ≥ 80 (admin pages don't need to be perfect).

End-to-end after Phase 2:
- All Phase 1 plus public RSVP flow: lookup → submit → email arrives → audit log row.

End-to-end after Phase 3:
- All Phase 2 plus registry admin (URL paste → OG fetch) → public registry page renders → deep-links open the right product page.

End-to-end after Phase 4:
- All Phase 3 plus Lighthouse ≥ 90 on every public page, accessibility audit clean, mobile viewport renders correctly.

---

## Out of scope (explicitly)

- Meal selection (deferred per Andrew).
- Live-day photo wall / event-day photo upload.
- Guest-to-guest features (commenting, claiming products, songs other than RSVP-time song requests).
- Internationalization (English only).
- A separate mobile app — responsive web only.
- Public guest list scrolling (rejected during brainstorm — privacy).
- Build a claim-tracking system for registry items (rejected — relies on each registry's native availability instead).

---

## Memory references (for future sessions)

Project memory at `/home/andrew/.claude/projects/-home-andrew-code-wedding/memory/` was seeded with:
- `user_profile.md` — Andrew's role and preferences.
- `feedback_brainstorming_for_complex_sessions.md` — invoke `superpowers:brainstorming` at session start for multi-decision work.
- `feedback_visual_companion.md` — use the brainstorming visual companion for visual questions.
- `project_stack_intent.md` — original stack intent from kickoff.

Update these as new conventions emerge during execution.

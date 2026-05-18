# Vendor Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a private, admin-only vendor tracker — list grouped by category with status / price / what-it-includes tags, plus a budget bar mirroring the existing `CapacityBar`.

**Architecture:** Single Convex `vendors` table. App-level constants for categories and the controlled `includes` vocabulary so we can expand without schema migrations. UI under `/admin/vendors` reuses the existing `(admin)` Clerk-gated layout. Budget input added to the existing settings page; budget value stored in the existing `settings` key/value table under `weddingBudget`.

**Tech Stack:** Next.js 16 App Router · TypeScript strict · Convex 1.37 · Clerk auth · Tailwind v4 · shadcn/ui · sonner for toasts · react-hook-form (already in deps; used in guest-form pattern). No new dependencies required for the feature itself.

**Spec:** `docs/superpowers/specs/2026-05-17-vendor-management-design.md`

**Testing posture:** The project currently has no test runner. Verification at every task is: `pnpm lint` + `pnpm typecheck` + driving the relevant page in the dev server. Adding Vitest + `convex-test` is intentionally out of scope for this plan — bringing in a test framework is its own decision. The spec's "Testing" section is therefore deferred. If/when test infra arrives, the obvious early target is `vendors.rollups`.

---

## File structure

**Create:**
- `convex/vendors.ts` — queries (`list`, `get`, `rollups`) and mutations (`add`, `update`, `setStatus`, `bulkAdd`, `softDelete`).
- `src/lib/vendor-categories.ts` — `CATEGORIES` and `INCLUDES` const arrays, label helpers, `bundledTagToCategory` map.
- `src/components/admin/budget-bar.tsx` — mirrors `capacity-bar.tsx`.
- `src/components/admin/vendor-list.tsx` — grouped list rendering.
- `src/components/admin/vendor-row.tsx` — single row, including the "bundled stub" variant.
- `src/components/admin/vendor-toolbar.tsx` — search/filter/sort controls.
- `src/components/admin/vendor-form.tsx` — shared add/edit form.
- `src/components/admin/vendor-detail.tsx` — detail-page body.
- `src/components/admin/vendor-bulk-form.tsx` — JSON textarea bulk-add form.
- `src/app/(admin)/admin/vendors/page.tsx` — list page.
- `src/app/(admin)/admin/vendors/new/page.tsx` — add page.
- `src/app/(admin)/admin/vendors/[id]/page.tsx` — detail/edit page.
- `src/app/(admin)/admin/vendors/bulk/page.tsx` — bulk-add page.

**Modify:**
- `convex/schema.ts` — add `vendors` table.
- `src/app/(admin)/admin/layout.tsx` — add `Vendors` nav link between `Messages` and `Settings`.
- `src/app/(admin)/admin/settings/page.tsx` — add `weddingBudget` input.

---

## Task 0: Create a working branch

**Files:** none (git only).

- [ ] **Step 1: Branch off main**

```bash
git switch main && git pull --ff-only
git switch -c feature/vendor-management
```

- [ ] **Step 2: Verify clean tree**

Run: `git status`
Expected: `nothing to commit, working tree clean` and `On branch feature/vendor-management`.

---

## Task 1: Schema — add the `vendors` table

**Files:**
- Modify: `convex/schema.ts`

- [ ] **Step 1: Add the table definition**

Edit `convex/schema.ts`. Inside `defineSchema({ ... })`, after the existing `messages` table (and before the closing `})`), add:

```ts
  vendors: defineTable({
    // Identity
    name: v.string(),
    category: v.string(),
    customCategory: v.optional(v.string()),
    status: v.union(
      v.literal("considering"),
      v.literal("chosen"),
      v.literal("passed"),
    ),

    // Money
    priceTotal: v.optional(v.number()),
    priceUnit: v.optional(
      v.union(
        v.literal("flat"),
        v.literal("per_head"),
        v.literal("per_hour"),
      ),
    ),
    includes: v.array(v.string()),

    // Contact
    contactName: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    website: v.optional(v.string()),
    location: v.optional(v.string()),

    // Notes & links
    notes: v.optional(v.string()),
    links: v.array(
      v.object({
        label: v.string(),
        url: v.string(),
      }),
    ),

    // Milestones (inline)
    depositAmount: v.optional(v.number()),
    depositPaidAt: v.optional(v.number()),
    finalDueAt: v.optional(v.number()),
    finalPaidAt: v.optional(v.number()),

    // Subjective
    rating: v.optional(v.number()),
    pros: v.optional(v.string()),
    cons: v.optional(v.string()),

    // Lifecycle
    createdAt: v.number(),
    createdBy: v.string(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_category", ["category", "status"])
    .index("by_status", ["status"])
    .searchIndex("search_name", {
      searchField: "name",
      filterFields: ["category", "status", "deletedAt"],
    }),
```

- [ ] **Step 2: Run codegen and typecheck**

Run: `pnpm exec convex codegen --typecheck disable && pnpm typecheck`
Expected: codegen prints `Wrote convex/_generated/*` and `tsc --noEmit` exits 0.

If codegen warns about a missing `CONVEX_DEPLOYMENT`, ensure `.env.local` is populated (per `vercel env pull`).

- [ ] **Step 3: Commit**

```bash
git add convex/schema.ts convex/_generated/
git commit -m "Add vendors table to Convex schema"
```

---

## Task 2: App-level category & includes constants

**Files:**
- Create: `src/lib/vendor-categories.ts`

- [ ] **Step 1: Create the constants file**

Write `src/lib/vendor-categories.ts` with exactly this content:

```ts
/**
 * App-level taxonomy for vendor records. Lives outside the Convex schema so
 * we can extend either list without a schema migration. The schema stores
 * plain strings; we trust this module to enumerate the valid values for UI
 * filters, defaults, and the bundled-row stub mapping.
 */

export const CATEGORIES = [
  "venue",
  "catering",
  "bar",
  "photographer",
  "videographer",
  "florist",
  "dj_music",
  "live_music",
  "cake",
  "hair",
  "makeup",
  "rentals",
  "lighting_av",
  "officiant",
  "transportation",
  "stationery",
  "planner",
  "day_of_coordinator",
  "bride_attire",
  "groom_attire",
  "jewelry",
  "favors",
  "tent",
  "photo_booth",
  "restrooms",
  "welcome_bags",
  "rehearsal_dinner",
  "post_wedding_brunch",
  "honeymoon",
  "other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  venue: "Venue",
  catering: "Catering",
  bar: "Bar / Beverage",
  photographer: "Photographer",
  videographer: "Videographer",
  florist: "Florist",
  dj_music: "DJ / Music",
  live_music: "Live music / Band",
  cake: "Cake & Desserts",
  hair: "Hair",
  makeup: "Makeup",
  rentals: "Rentals",
  lighting_av: "Lighting / AV",
  officiant: "Officiant",
  transportation: "Transportation",
  stationery: "Stationery & Invitations",
  planner: "Wedding planner",
  day_of_coordinator: "Day-of coordinator",
  bride_attire: "Bride attire",
  groom_attire: "Groom attire",
  jewelry: "Jewelry & Rings",
  favors: "Favors & Gifts",
  tent: "Tent",
  photo_booth: "Photo booth",
  restrooms: "Restrooms",
  welcome_bags: "Welcome bags",
  rehearsal_dinner: "Rehearsal dinner",
  post_wedding_brunch: "Post-wedding brunch",
  honeymoon: "Honeymoon",
  other: "Other",
};

export const INCLUDES = [
  "catering",
  "bar",
  "linens",
  "tables_chairs",
  "plates_glassware",
  "day_of_coordinator",
  "setup_teardown",
  "service_staff",
  "cake_cutting",
  "sound_system",
  "lighting",
  "ceremony",
  "reception",
  "rehearsal",
  "cleanup",
  "accommodation",
  "parking",
] as const;

export type IncludeTag = (typeof INCLUDES)[number];

export const INCLUDE_LABELS: Record<IncludeTag, string> = {
  catering: "Catering",
  bar: "Bar",
  linens: "Linens",
  tables_chairs: "Tables & chairs",
  plates_glassware: "Plates & glassware",
  day_of_coordinator: "Day-of coordinator",
  setup_teardown: "Setup & teardown",
  service_staff: "Service staff",
  cake_cutting: "Cake cutting",
  sound_system: "Sound system",
  lighting: "Lighting",
  ceremony: "Ceremony site",
  reception: "Reception site",
  rehearsal: "Rehearsal access",
  cleanup: "Cleanup",
  accommodation: "Accommodation",
  parking: "Parking",
};

/**
 * Map an `includes` tag to a category whose section should render a
 * "covered by X" stub row when a chosen vendor's includes contains the tag.
 * Tags with no corresponding category (e.g. linens, lighting) return null —
 * they're displayed only as inline chips on the source vendor's row.
 */
export const BUNDLED_TAG_TO_CATEGORY: Partial<Record<IncludeTag, Category>> = {
  catering: "catering",
  bar: "bar",
  day_of_coordinator: "day_of_coordinator",
  lighting: "lighting_av",
  sound_system: "lighting_av",
};

export function categoryLabel(value: string, customCategory?: string): string {
  if (value === "other" && customCategory?.trim()) return customCategory.trim();
  return CATEGORY_LABELS[value as Category] ?? value;
}

export function includeLabel(value: string): string {
  return INCLUDE_LABELS[value as IncludeTag] ?? value;
}

export const PRICE_UNITS = ["flat", "per_head", "per_hour"] as const;
export type PriceUnit = (typeof PRICE_UNITS)[number];

export const PRICE_UNIT_LABELS: Record<PriceUnit, string> = {
  flat: "flat",
  per_head: "per head",
  per_hour: "per hour",
};

export const STATUSES = ["considering", "chosen", "passed"] as const;
export type VendorStatus = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<VendorStatus, string> = {
  considering: "Considering",
  chosen: "Chosen",
  passed: "Passed",
};
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/lib/vendor-categories.ts
git commit -m "Add vendor categories, includes vocabulary, and bundled-tag map"
```

---

## Task 3: Convex queries — `list`, `get`, `rollups`

**Files:**
- Create: `convex/vendors.ts`

- [ ] **Step 1: Create the file with queries only**

Write `convex/vendors.ts` with:

```ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { type Doc, type Id } from "./_generated/dataModel";
import { requireAdmin } from "./lib/auth";

const VENDOR_STATUS = v.union(
  v.literal("considering"),
  v.literal("chosen"),
  v.literal("passed"),
);

const PRICE_UNIT = v.union(
  v.literal("flat"),
  v.literal("per_head"),
  v.literal("per_hour"),
);

const LINK = v.object({
  label: v.string(),
  url: v.string(),
});

/* ----------------------------------------------------------------------
   Queries
   -------------------------------------------------------------------- */

export const list = query({
  args: {
    category: v.optional(v.string()),
    status: v.optional(VENDOR_STATUS),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const all = await ctx.db.query("vendors").collect();
    const search = args.search?.trim().toLowerCase();
    return all
      .filter((vRow) => vRow.deletedAt === undefined)
      .filter((vRow) =>
        args.category ? vRow.category === args.category : true,
      )
      .filter((vRow) => (args.status ? vRow.status === args.status : true))
      .filter((vRow) => {
        if (!search) return true;
        const hay = [
          vRow.name,
          vRow.location ?? "",
          vRow.contactName ?? "",
          vRow.notes ?? "",
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(search);
      })
      .sort((a, b) => {
        const byCat = a.category.localeCompare(b.category);
        if (byCat !== 0) return byCat;
        return a.name.localeCompare(b.name);
      });
  },
});

export const get = query({
  args: { id: v.id("vendors") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db.get(args.id);
  },
});

/**
 * Aggregate dollars across vendors for the BudgetBar.
 *
 * Per-head pricing is multiplied by the current confirmed-RSVP count read
 * from the guests table. Per-hour quotes can't be auto-resolved (we don't
 * know how many hours), so they contribute their face value as a best-guess
 * lower bound and the UI labels them "est." in the row.
 *
 * Returns dollars (integers). Soft-deleted vendors are excluded.
 */
export const rollups = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const vendorRows = (await ctx.db.query("vendors").collect()).filter(
      (vRow) => vRow.deletedAt === undefined,
    );

    // Confirmed-RSVP count: yes + plus-ones who said yes (only when allowed).
    const guests = await ctx.db
      .query("guests")
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();
    const confirmedHeadcount = guests.reduce((n, g) => {
      let add = g.rsvpStatus === "yes" ? 1 : 0;
      if (g.plusOneAllowed && g.plusOneRsvp === "yes") add += 1;
      return n + add;
    }, 0);

    function resolvePrice(vRow: Doc<"vendors">): number {
      if (vRow.priceTotal == null) return 0;
      if (vRow.priceUnit === "per_head") {
        return vRow.priceTotal * confirmedHeadcount;
      }
      return vRow.priceTotal;
    }

    const chosen = vendorRows.filter((vRow) => vRow.status === "chosen");
    const considering = vendorRows.filter(
      (vRow) => vRow.status === "considering",
    );

    const committed = chosen.reduce((n, vRow) => n + resolvePrice(vRow), 0);
    const consideringTotal = considering.reduce(
      (n, vRow) => n + resolvePrice(vRow),
      0,
    );

    const depositsPaid = chosen.reduce(
      (n, vRow) =>
        n +
        (vRow.depositPaidAt != null ? (vRow.depositAmount ?? 0) : 0),
      0,
    );
    const outstanding = Math.max(0, committed - depositsPaid);

    const horizon = Date.now() + 30 * 24 * 60 * 60 * 1000;
    const upcoming30d = chosen
      .filter(
        (vRow) =>
          vRow.finalDueAt != null &&
          vRow.finalPaidAt == null &&
          vRow.finalDueAt <= horizon,
      )
      .map((vRow) => ({
        id: vRow._id,
        name: vRow.name,
        dueAt: vRow.finalDueAt as number,
        // amount = remaining after deposit, falling back to priceTotal if no
        // deposit is recorded.
        amount: Math.max(
          0,
          resolvePrice(vRow) -
            (vRow.depositPaidAt != null ? (vRow.depositAmount ?? 0) : 0),
        ),
      }))
      .sort((a, b) => a.dueAt - b.dueAt);

    return {
      chosenCount: chosen.length,
      consideringCount: considering.length,
      committed,
      consideringTotal,
      depositsPaid,
      outstanding,
      confirmedHeadcount,
      upcoming30d,
    };
  },
});

// Re-export types for client consumers
export type Vendor = Doc<"vendors">;
export type VendorId = Id<"vendors">;
```

> Mutations are added in Task 4. The unused imports (`mutation`, `VENDOR_STATUS`, `PRICE_UNIT`, `LINK`) will be referenced there. To keep typecheck clean for this commit, suppress them in this single intermediate step by appending `// eslint-disable-next-line @typescript-eslint/no-unused-vars` lines, OR — preferred — fold Task 3 and Task 4 into a single commit and run typecheck only at the end of Task 4.

> **Recommendation:** combine Task 3 and Task 4 commits. Leave Task 3's commit hook unrun; finish Task 4 and commit together. The plan keeps them as separate logical units for readability.

- [ ] **Step 2: Manually verify queries via Convex dashboard**

Run: `pnpm dev` in one shell. In another, open the Convex dashboard (URL printed by the dev server) → Functions → `vendors.list` and run with no args. Expected: empty array `[]` and no error. Run `vendors.rollups` — expected: object with all-zero numbers and `upcoming30d: []`.

- [ ] **Step 3: Do not commit yet — proceed to Task 4**

---

## Task 4: Convex mutations — `add`, `update`, `setStatus`, `bulkAdd`, `softDelete`

**Files:**
- Modify: `convex/vendors.ts`

- [ ] **Step 1: Append the mutations**

At the bottom of `convex/vendors.ts` (above the `Vendor`/`VendorId` re-exports), add:

```ts
/* ----------------------------------------------------------------------
   Mutations
   -------------------------------------------------------------------- */

const vendorFields = {
  name: v.string(),
  category: v.string(),
  customCategory: v.optional(v.string()),
  status: v.optional(VENDOR_STATUS),
  priceTotal: v.optional(v.number()),
  priceUnit: v.optional(PRICE_UNIT),
  includes: v.optional(v.array(v.string())),
  contactName: v.optional(v.string()),
  phone: v.optional(v.string()),
  email: v.optional(v.string()),
  website: v.optional(v.string()),
  location: v.optional(v.string()),
  notes: v.optional(v.string()),
  links: v.optional(v.array(LINK)),
  depositAmount: v.optional(v.number()),
  depositPaidAt: v.optional(v.number()),
  finalDueAt: v.optional(v.number()),
  finalPaidAt: v.optional(v.number()),
  rating: v.optional(v.number()),
  pros: v.optional(v.string()),
  cons: v.optional(v.string()),
};

export const add = mutation({
  args: vendorFields,
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);
    const now = Date.now();
    const id = await ctx.db.insert("vendors", {
      name: args.name.trim(),
      category: args.category,
      customCategory: args.customCategory?.trim() || undefined,
      status: args.status ?? "considering",
      priceTotal: args.priceTotal,
      priceUnit: args.priceUnit,
      includes: args.includes ?? [],
      contactName: args.contactName?.trim() || undefined,
      phone: args.phone?.trim() || undefined,
      email: args.email?.trim() || undefined,
      website: args.website?.trim() || undefined,
      location: args.location?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
      links: args.links ?? [],
      depositAmount: args.depositAmount,
      depositPaidAt: args.depositPaidAt,
      finalDueAt: args.finalDueAt,
      finalPaidAt: args.finalPaidAt,
      rating: args.rating,
      pros: args.pros?.trim() || undefined,
      cons: args.cons?.trim() || undefined,
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
    });
    return { id };
  },
});

export const update = mutation({
  args: {
    id: v.id("vendors"),
    ...vendorFields,
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Vendor not found");
    const now = Date.now();
    await ctx.db.patch(args.id, {
      name: args.name.trim(),
      category: args.category,
      customCategory: args.customCategory?.trim() || undefined,
      status: args.status ?? existing.status,
      priceTotal: args.priceTotal,
      priceUnit: args.priceUnit,
      includes: args.includes ?? existing.includes,
      contactName: args.contactName?.trim() || undefined,
      phone: args.phone?.trim() || undefined,
      email: args.email?.trim() || undefined,
      website: args.website?.trim() || undefined,
      location: args.location?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
      links: args.links ?? existing.links,
      depositAmount: args.depositAmount,
      depositPaidAt: args.depositPaidAt,
      finalDueAt: args.finalDueAt,
      finalPaidAt: args.finalPaidAt,
      rating: args.rating,
      pros: args.pros?.trim() || undefined,
      cons: args.cons?.trim() || undefined,
      updatedAt: now,
    });
    return args.id;
  },
});

export const setStatus = mutation({
  args: { id: v.id("vendors"), status: VENDOR_STATUS },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Vendor not found");
    await ctx.db.patch(args.id, {
      status: args.status,
      updatedAt: Date.now(),
    });
  },
});

export const softDelete = mutation({
  args: { id: v.id("vendors") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Vendor not found");
    await ctx.db.patch(args.id, {
      deletedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const restore = mutation({
  args: { id: v.id("vendors") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Vendor not found");
    await ctx.db.patch(args.id, {
      deletedAt: undefined,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Insert many vendors at once. Each row is validated by the schema; on any
 * row failure we record the error string and continue. Returns a per-row
 * summary so the caller can surface partial successes.
 */
export const bulkAdd = mutation({
  args: { rows: v.array(v.object(vendorFields)) },
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);
    const now = Date.now();
    let inserted = 0;
    const errors: Array<{ index: number; message: string }> = [];

    for (let i = 0; i < args.rows.length; i++) {
      const r = args.rows[i];
      try {
        await ctx.db.insert("vendors", {
          name: r.name.trim(),
          category: r.category,
          customCategory: r.customCategory?.trim() || undefined,
          status: r.status ?? "considering",
          priceTotal: r.priceTotal,
          priceUnit: r.priceUnit,
          includes: r.includes ?? [],
          contactName: r.contactName?.trim() || undefined,
          phone: r.phone?.trim() || undefined,
          email: r.email?.trim() || undefined,
          website: r.website?.trim() || undefined,
          location: r.location?.trim() || undefined,
          notes: r.notes?.trim() || undefined,
          links: r.links ?? [],
          depositAmount: r.depositAmount,
          depositPaidAt: r.depositPaidAt,
          finalDueAt: r.finalDueAt,
          finalPaidAt: r.finalPaidAt,
          rating: r.rating,
          pros: r.pros?.trim() || undefined,
          cons: r.cons?.trim() || undefined,
          createdAt: now,
          createdBy: userId,
          updatedAt: now,
        });
        inserted++;
      } catch (err) {
        errors.push({
          index: i,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return { inserted, errors };
  },
});
```

- [ ] **Step 2: Typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: both exit 0. If any unused-import warning fires, ensure the symbol is referenced by the mutations you just added.

- [ ] **Step 3: Smoke-test add + list via Convex dashboard**

Run: ensure `pnpm dev` is still running. In the Convex dashboard, run `vendors.add` with:

```json
{
  "name": "Test Venue",
  "category": "venue",
  "status": "chosen",
  "priceTotal": 20000,
  "priceUnit": "flat",
  "includes": ["catering", "bar", "linens"]
}
```

Then run `vendors.list` (no args) — expected: array with one row. Run `vendors.rollups` — expected: `committed: 20000`, `chosenCount: 1`.

Clean up by running `vendors.softDelete` with the returned `id` — `vendors.list` should now be empty.

- [ ] **Step 4: Commit Tasks 3 + 4 together**

```bash
git add convex/vendors.ts
git commit -m "Add vendors Convex queries and mutations"
```

---

## Task 5: Admin nav — add the Vendors link

**Files:**
- Modify: `src/app/(admin)/admin/layout.tsx`

- [ ] **Step 1: Add the nav link**

In `src/app/(admin)/admin/layout.tsx`, between the `<MessagesNavLink />` line and the `<Link href="/admin/settings" ...>` block, add:

```tsx
            <Link
              href="/admin/vendors"
              className="text-foreground hover:text-foreground/70 py-2 -my-2"
            >
              Vendors
            </Link>
```

No mobile abbreviation needed — "Vendors" fits in the existing layout. Match the surrounding indentation/style exactly.

- [ ] **Step 2: Verify in browser**

Run: `pnpm dev` (or refresh if already running). Open `http://localhost:3000/admin`. Expected: the top nav now shows `Guests · QR/Invitations · Import · Messages · Vendors · Settings`. Clicking Vendors 404s for now — that's expected, the page is built in Task 9.

- [ ] **Step 3: Lint and commit**

```bash
pnpm lint
git add src/app/(admin)/admin/layout.tsx
git commit -m "Add Vendors link to admin nav"
```

---

## Task 6: BudgetBar component

**Files:**
- Create: `src/components/admin/budget-bar.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/lib/convex";
import { Skeleton } from "@/components/ui/skeleton";

const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

/**
 * Mirrors CapacityBar: committed (filled) + considering (soft band) over
 * a budget denominator. If no budget is set, the denominator is the sum of
 * committed + considering so the bar always fills.
 */
export function BudgetBar() {
  const rollups = useQuery(api.vendors.rollups);
  const settings = useQuery(api.settings.all);

  if (rollups === undefined || settings === undefined) {
    return <Skeleton className="h-20" />;
  }

  const budget =
    typeof settings.weddingBudget === "number"
      ? (settings.weddingBudget as number)
      : null;

  const committed = rollups.committed;
  const considering = rollups.consideringTotal;
  const projected = committed + considering;

  const denom = budget ?? Math.max(projected, 1);
  const committedPct = Math.min(100, (committed / denom) * 100);
  const consideringPct = Math.min(
    100 - committedPct,
    (considering / denom) * 100,
  );
  const overflowPct =
    budget != null && projected > budget
      ? Math.min(15, ((projected - budget) / denom) * 100)
      : 0;

  const overBudget = budget != null && projected > budget;
  const nearBudget =
    budget != null && !overBudget && projected >= budget * 0.9;

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-baseline justify-between">
        <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
          Budget outlook
        </h3>
        {budget != null ? (
          <span className="text-xs text-muted-foreground">
            Budget:{" "}
            <span className="text-foreground font-medium tabular-nums">
              {USD.format(budget)}
            </span>
          </span>
        ) : (
          <Link
            href="/admin/settings"
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Set wedding budget →
          </Link>
        )}
      </div>

      <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="absolute inset-y-0 left-0 bg-[var(--status-yes)] transition-all"
          style={{ width: `${committedPct}%` }}
          aria-label="Committed"
        />
        <div
          className={`absolute inset-y-0 transition-all ${
            overBudget
              ? "bg-[var(--status-no)]/40"
              : nearBudget
                ? "bg-[var(--status-offline)]/50"
                : "bg-[var(--status-yes)]/30"
          }`}
          style={{ left: `${committedPct}%`, width: `${consideringPct}%` }}
          aria-label="Considering"
        />
        {budget != null && (
          <div
            className="absolute inset-y-0 w-px bg-foreground/40"
            style={{ left: `${(budget / denom) * 100}%` }}
            aria-label="Budget"
          />
        )}
        {overflowPct > 0 && (
          <div
            className="absolute inset-y-0 right-0 bg-[var(--status-no)]"
            style={{ width: `${overflowPct}%` }}
            aria-label="Over budget"
          />
        )}
      </div>

      <p className="text-sm text-foreground tabular-nums">
        <span className="font-medium">{USD.format(committed)}</span>{" "}
        committed
        {considering > 0 && (
          <>
            {" · "}
            <span
              className={
                overBudget
                  ? "text-[var(--status-no)] font-medium"
                  : nearBudget
                    ? "text-[var(--status-offline)] font-medium"
                    : "text-muted-foreground"
              }
            >
              up to {USD.format(projected)} if all considering are chosen
            </span>
          </>
        )}
        {budget != null && !overBudget && (
          <>
            {" · "}
            <span className="text-muted-foreground">
              {USD.format(Math.max(0, budget - projected))} remaining
            </span>
          </>
        )}
      </p>

      {overBudget && (
        <p className="text-xs text-[var(--status-no)]">
          Projected to exceed your budget by{" "}
          {USD.format(projected - (budget as number))}. Consider trimming the
          shortlist.
        </p>
      )}
      {nearBudget && (
        <p className="text-xs text-[var(--status-offline)]">
          Within 10% of budget if every considering vendor is chosen.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Lint and typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: both exit 0.

- [ ] **Step 3: Commit**

The component is not yet rendered anywhere; visual verification happens in Task 9.

```bash
git add src/components/admin/budget-bar.tsx
git commit -m "Add BudgetBar admin component"
```

---

## Task 7: Vendor row + list components

**Files:**
- Create: `src/components/admin/vendor-row.tsx`
- Create: `src/components/admin/vendor-list.tsx`

- [ ] **Step 1: Create `vendor-row.tsx`**

```tsx
"use client";

import Link from "next/link";
import type { Doc } from "@/lib/convex";
import {
  categoryLabel,
  includeLabel,
  PRICE_UNIT_LABELS,
  type VendorStatus,
} from "@/lib/vendor-categories";

const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

type Vendor = Doc<"vendors">;

const STATUS_CLASSES: Record<VendorStatus, string> = {
  considering: "bg-[var(--status-pending)]/20 text-[var(--status-pending)]",
  chosen: "bg-[var(--status-yes)]/20 text-[var(--status-yes)]",
  passed: "bg-muted text-muted-foreground",
};

export function VendorRow({
  vendor,
  confirmedHeadcount,
}: {
  vendor: Vendor;
  confirmedHeadcount: number;
}) {
  const priceDisplay = renderPrice(vendor, confirmedHeadcount);
  return (
    <Link
      href={`/admin/vendors/${vendor._id}`}
      className="grid grid-cols-[auto_1fr_auto_auto] gap-3 sm:gap-4 items-center px-4 py-3 border-b border-border last:border-b-0 hover:bg-muted/40 transition-colors"
    >
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground bg-muted px-2 py-0.5 rounded-full whitespace-nowrap">
        {categoryLabel(vendor.category, vendor.customCategory)}
      </span>

      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground truncate">
          {vendor.name}
          {vendor.location && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              · {vendor.location}
            </span>
          )}
        </div>
        {vendor.includes.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {vendor.includes.map((tag) => (
              <span
                key={tag}
                className="text-[10px] bg-[var(--accent)]/10 text-[var(--accent)] px-1.5 py-0.5 rounded"
              >
                {includeLabel(tag)}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="text-right tabular-nums">
        <div className="text-sm text-foreground">{priceDisplay.main}</div>
        {priceDisplay.sub && (
          <div className="text-[10px] text-muted-foreground">
            {priceDisplay.sub}
          </div>
        )}
      </div>

      <span
        className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-full whitespace-nowrap ${STATUS_CLASSES[vendor.status]}`}
      >
        {vendor.status}
      </span>
    </Link>
  );
}

export function VendorBundledStub({
  category,
  sourceVendor,
}: {
  category: string;
  sourceVendor: Pick<Vendor, "_id" | "name" | "customCategory" | "category">;
}) {
  return (
    <Link
      href={`/admin/vendors/${sourceVendor._id}`}
      className="grid grid-cols-[auto_1fr_auto_auto] gap-3 sm:gap-4 items-center px-4 py-3 border-b border-border last:border-b-0 opacity-60 hover:opacity-100 hover:bg-muted/40 transition-all"
    >
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground bg-muted px-2 py-0.5 rounded-full whitespace-nowrap">
        {categoryLabel(category)}
      </span>
      <div className="text-sm italic text-muted-foreground truncate">
        — covered by {sourceVendor.name} —
      </div>
      <div className="text-right text-sm text-muted-foreground">incl.</div>
      <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full whitespace-nowrap bg-[var(--status-yes)]/20 text-[var(--status-yes)]">
        bundled
      </span>
    </Link>
  );
}

function renderPrice(
  vendor: Vendor,
  confirmedHeadcount: number,
): { main: string; sub?: string } {
  if (vendor.priceTotal == null) return { main: "—" };
  const unitLabel =
    vendor.priceUnit != null ? PRICE_UNIT_LABELS[vendor.priceUnit] : "flat";
  if (vendor.priceUnit === "per_head") {
    if (confirmedHeadcount === 0) {
      return {
        main: `${USD.format(vendor.priceTotal)}`,
        sub: `est. — · ${unitLabel}`,
      };
    }
    return {
      main: USD.format(vendor.priceTotal * confirmedHeadcount),
      sub: `est. ${confirmedHeadcount} × ${USD.format(vendor.priceTotal)}`,
    };
  }
  return { main: USD.format(vendor.priceTotal), sub: unitLabel };
}
```

- [ ] **Step 2: Create `vendor-list.tsx`**

```tsx
"use client";

import { useQuery } from "convex/react";
import { api } from "@/lib/convex";
import type { Doc } from "@/lib/convex";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BUNDLED_TAG_TO_CATEGORY,
  CATEGORIES,
  categoryLabel,
  type Category,
  type IncludeTag,
} from "@/lib/vendor-categories";
import { VendorBundledStub, VendorRow } from "./vendor-row";

type Vendor = Doc<"vendors">;

export function VendorList({
  category,
  status,
  search,
}: {
  category?: Category | "all";
  status?: "considering" | "chosen" | "passed" | "all";
  search?: string;
}) {
  const vendors = useQuery(api.vendors.list, {
    category: category && category !== "all" ? category : undefined,
    status: status && status !== "all" ? status : undefined,
    search: search?.trim() || undefined,
  });
  const rollups = useQuery(api.vendors.rollups);

  if (vendors === undefined || rollups === undefined) {
    return <Skeleton className="h-64" />;
  }

  if (vendors.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No vendors yet. Click <span className="font-medium">+ Add vendor</span>{" "}
        above to start your shortlist.
      </div>
    );
  }

  // Group by category (preserving the CATEGORIES order; "other" + unknowns
  // fall to the end).
  const byCategory = new Map<string, Vendor[]>();
  for (const vendor of vendors) {
    const arr = byCategory.get(vendor.category) ?? [];
    arr.push(vendor);
    byCategory.set(vendor.category, arr);
  }

  // Bundled-stub map: category → [chosen vendor that bundles it]
  const bundledByCategory = new Map<string, Vendor[]>();
  // Use the unfiltered list of all chosen vendors so bundled stubs render
  // even when the user has filtered the visible list down. We approximate
  // by re-using the same `vendors` (the rollups query doesn't return rows);
  // if a strict filter is applied, missing source vendors simply show no
  // stub — acceptable for v1.
  for (const vendor of vendors) {
    if (vendor.status !== "chosen") continue;
    for (const tag of vendor.includes) {
      const targetCat = BUNDLED_TAG_TO_CATEGORY[tag as IncludeTag];
      if (!targetCat) continue;
      // Don't render a stub in the same category as the source vendor.
      if (targetCat === vendor.category) continue;
      const arr = bundledByCategory.get(targetCat) ?? [];
      arr.push(vendor);
      bundledByCategory.set(targetCat, arr);
    }
  }

  const orderedCategories = [
    ...CATEGORIES.filter((c) => byCategory.has(c) || bundledByCategory.has(c)),
    ...Array.from(byCategory.keys()).filter(
      (c) => !CATEGORIES.includes(c as Category),
    ),
  ];

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {orderedCategories.map((cat) => {
        const rows = byCategory.get(cat) ?? [];
        const stubs = bundledByCategory.get(cat) ?? [];
        if (rows.length === 0 && stubs.length === 0) return null;
        return (
          <div key={cat}>
            <div className="px-4 py-2 bg-muted/40 text-[11px] uppercase tracking-widest text-muted-foreground font-medium border-b border-border">
              {categoryLabel(cat)}
            </div>
            {stubs.map((source) => (
              <VendorBundledStub
                key={`stub-${cat}-${source._id}`}
                category={cat}
                sourceVendor={source}
              />
            ))}
            {rows.map((vendor) => (
              <VendorRow
                key={vendor._id}
                vendor={vendor}
                confirmedHeadcount={rollups.confirmedHeadcount}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Lint and typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: both exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/vendor-row.tsx src/components/admin/vendor-list.tsx
git commit -m "Add VendorRow, VendorBundledStub, and VendorList components"
```

---

## Task 8: Vendor toolbar (search/filter/sort)

**Files:**
- Create: `src/components/admin/vendor-toolbar.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import Link from "next/link";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  STATUSES,
  STATUS_LABELS,
  type Category,
  type VendorStatus,
} from "@/lib/vendor-categories";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type VendorFilters = {
  search: string;
  category: Category | "all";
  status: VendorStatus | "all";
};

export function VendorToolbar({
  value,
  onChange,
}: {
  value: VendorFilters;
  onChange: (next: VendorFilters) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
      <Input
        value={value.search}
        onChange={(e) => onChange({ ...value, search: e.target.value })}
        placeholder="Search vendors…"
        className="max-w-xs"
      />
      <select
        value={value.category}
        onChange={(e) =>
          onChange({ ...value, category: e.target.value as Category | "all" })
        }
        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
      >
        <option value="all">All categories</option>
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {CATEGORY_LABELS[c]}
          </option>
        ))}
      </select>
      <select
        value={value.status}
        onChange={(e) =>
          onChange({
            ...value,
            status: e.target.value as VendorStatus | "all",
          })
        }
        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
      >
        <option value="all">All statuses</option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      <div className="ml-auto flex gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/vendors/bulk">Bulk add</Link>
        </Button>
        <Button asChild size="sm">
          <Link href="/admin/vendors/new">+ Add vendor</Link>
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Lint and typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: both exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/vendor-toolbar.tsx
git commit -m "Add VendorToolbar with search, category, status filters"
```

---

## Task 9: Vendors list page

**Files:**
- Create: `src/app/(admin)/admin/vendors/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
"use client";

import { useState } from "react";
import { BudgetBar } from "@/components/admin/budget-bar";
import {
  VendorToolbar,
  type VendorFilters,
} from "@/components/admin/vendor-toolbar";
import { VendorList } from "@/components/admin/vendor-list";

export default function VendorsPage() {
  const [filters, setFilters] = useState<VendorFilters>({
    search: "",
    category: "all",
    status: "all",
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl">Vendors</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track candidates, lock in chosen vendors, and watch the budget.
        </p>
      </div>

      <BudgetBar />
      <VendorToolbar value={filters} onChange={setFilters} />
      <VendorList
        category={filters.category}
        status={filters.status}
        search={filters.search}
      />
    </div>
  );
}
```

- [ ] **Step 2: Browser verify**

Run: `pnpm dev` if not running. Navigate to `http://localhost:3000/admin/vendors`.

Expected on a fresh DB (no vendors): page renders with header, BudgetBar showing a "Set wedding budget →" link and $0 committed, toolbar with the two action buttons, and the empty state ("No vendors yet…").

Add a vendor via the Convex dashboard (as in Task 4) — list should update in real-time without refresh.

- [ ] **Step 3: Lint and typecheck**

Run: `pnpm lint && pnpm typecheck`

- [ ] **Step 4: Commit**

```bash
git add src/app/(admin)/admin/vendors/page.tsx
git commit -m "Add /admin/vendors list page"
```

---

## Task 10: Shared vendor form component

**Files:**
- Create: `src/components/admin/vendor-form.tsx`

- [ ] **Step 1: Write the form**

The form uses local `useState` (matching the pattern in `settings/page.tsx`) rather than react-hook-form, to keep it small and obvious. Covers every editable field.

```tsx
"use client";

import { useState, useTransition } from "react";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/convex";
import type { Doc, Id } from "@/lib/convex";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  INCLUDES,
  INCLUDE_LABELS,
  PRICE_UNITS,
  PRICE_UNIT_LABELS,
  STATUSES,
  STATUS_LABELS,
} from "@/lib/vendor-categories";

type Vendor = Doc<"vendors">;

export function VendorForm({ existing }: { existing?: Vendor }) {
  const router = useRouter();
  const add = useMutation(api.vendors.add);
  const update = useMutation(api.vendors.update);
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState(existing?.name ?? "");
  const [category, setCategory] = useState(existing?.category ?? "venue");
  const [customCategory, setCustomCategory] = useState(
    existing?.customCategory ?? "",
  );
  const [status, setStatus] = useState(existing?.status ?? "considering");
  const [priceTotal, setPriceTotal] = useState<string>(
    existing?.priceTotal != null ? String(existing.priceTotal) : "",
  );
  const [priceUnit, setPriceUnit] = useState<string>(
    existing?.priceUnit ?? "flat",
  );
  const [includes, setIncludes] = useState<string[]>(
    existing?.includes ?? [],
  );
  const [contactName, setContactName] = useState(existing?.contactName ?? "");
  const [phone, setPhone] = useState(existing?.phone ?? "");
  const [email, setEmail] = useState(existing?.email ?? "");
  const [website, setWebsite] = useState(existing?.website ?? "");
  const [location, setLocation] = useState(existing?.location ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [pros, setPros] = useState(existing?.pros ?? "");
  const [cons, setCons] = useState(existing?.cons ?? "");
  const [rating, setRating] = useState<string>(
    existing?.rating != null ? String(existing.rating) : "",
  );
  const [depositAmount, setDepositAmount] = useState<string>(
    existing?.depositAmount != null ? String(existing.depositAmount) : "",
  );
  const [depositPaid, setDepositPaid] = useState<boolean>(
    existing?.depositPaidAt != null,
  );
  const [finalDueAt, setFinalDueAt] = useState<string>(
    existing?.finalDueAt
      ? new Date(existing.finalDueAt).toISOString().slice(0, 10)
      : "",
  );
  const [finalPaid, setFinalPaid] = useState<boolean>(
    existing?.finalPaidAt != null,
  );

  function toggleInclude(tag: string) {
    setIncludes((cur) =>
      cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag],
    );
  }

  function save() {
    startTransition(async () => {
      try {
        const trimmedName = name.trim();
        if (!trimmedName) {
          toast.error("Name is required");
          return;
        }
        const parsedPrice = priceTotal.trim()
          ? Number.parseInt(priceTotal.trim(), 10)
          : undefined;
        if (priceTotal.trim() && !Number.isFinite(parsedPrice)) {
          toast.error("Price must be a whole number of dollars");
          return;
        }
        const parsedRating = rating.trim()
          ? Number.parseInt(rating.trim(), 10)
          : undefined;
        const parsedDeposit = depositAmount.trim()
          ? Number.parseInt(depositAmount.trim(), 10)
          : undefined;
        const parsedFinalDue = finalDueAt
          ? new Date(`${finalDueAt}T00:00:00`).getTime()
          : undefined;

        const payload = {
          name: trimmedName,
          category,
          customCategory:
            category === "other" ? customCategory.trim() || undefined : undefined,
          status: status as Vendor["status"],
          priceTotal: parsedPrice,
          priceUnit: parsedPrice != null
            ? (priceUnit as Vendor["priceUnit"])
            : undefined,
          includes,
          contactName: contactName.trim() || undefined,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          website: website.trim() || undefined,
          location: location.trim() || undefined,
          notes: notes.trim() || undefined,
          pros: pros.trim() || undefined,
          cons: cons.trim() || undefined,
          rating: parsedRating,
          depositAmount: parsedDeposit,
          depositPaidAt: depositPaid ? Date.now() : undefined,
          finalDueAt: parsedFinalDue,
          finalPaidAt: finalPaid ? Date.now() : undefined,
        };

        if (existing) {
          await update({ id: existing._id, ...payload });
          toast.success("Vendor updated");
          router.push(`/admin/vendors/${existing._id}`);
        } else {
          const { id } = await add(payload);
          toast.success("Vendor added");
          router.push(`/admin/vendors/${id as Id<"vendors">}`);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Category">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </Field>
        {category === "other" && (
          <Field label="Custom category label">
            <Input
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
            />
          </Field>
        )}
        <Field label="Status">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as Vendor["status"])}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Location">
          <Input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="City, state"
          />
        </Field>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Price (USD, integer)">
          <Input
            type="number"
            min={0}
            value={priceTotal}
            onChange={(e) => setPriceTotal(e.target.value)}
          />
        </Field>
        <Field label="Price unit">
          <select
            value={priceUnit}
            onChange={(e) => setPriceUnit(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            {PRICE_UNITS.map((u) => (
              <option key={u} value={u}>
                {PRICE_UNIT_LABELS[u]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Rating (1–5)">
          <Input
            type="number"
            min={1}
            max={5}
            value={rating}
            onChange={(e) => setRating(e.target.value)}
          />
        </Field>
      </section>

      <section>
        <Label className="text-xs uppercase tracking-widest text-muted-foreground">
          What it includes
        </Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {INCLUDES.map((tag) => (
            <label
              key={tag}
              className={`cursor-pointer rounded-full px-3 py-1 text-xs border transition-colors ${
                includes.includes(tag)
                  ? "bg-[var(--accent)]/15 border-[var(--accent)] text-foreground"
                  : "bg-background border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={includes.includes(tag)}
                onChange={() => toggleInclude(tag)}
              />
              {INCLUDE_LABELS[tag]}
            </label>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Contact name">
          <Input
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
          />
        </Field>
        <Field label="Phone">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="Email">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Website">
          <Input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </Field>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Deposit amount (USD)">
          <Input
            type="number"
            min={0}
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
          />
        </Field>
        <Field label="Final payment due">
          <Input
            type="date"
            value={finalDueAt}
            onChange={(e) => setFinalDueAt(e.target.value)}
          />
        </Field>
        <div className="flex items-center gap-2">
          <Checkbox
            id="deposit-paid"
            checked={depositPaid}
            onCheckedChange={(v) => setDepositPaid(v === true)}
          />
          <Label htmlFor="deposit-paid">Deposit paid</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="final-paid"
            checked={finalPaid}
            onCheckedChange={(v) => setFinalPaid(v === true)}
          />
          <Label htmlFor="final-paid">Final payment paid</Label>
        </div>
      </section>

      <section className="space-y-4">
        <Field label="Notes (markdown)">
          <Textarea
            rows={6}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything to remember…"
          />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Pros">
            <Textarea
              rows={3}
              value={pros}
              onChange={(e) => setPros(e.target.value)}
            />
          </Field>
          <Field label="Cons">
            <Textarea
              rows={3}
              value={cons}
              onChange={(e) => setCons(e.target.value)}
            />
          </Field>
        </div>
      </section>

      <div className="flex gap-2 pt-4 border-t border-border">
        <Button onClick={save} disabled={pending}>
          {existing ? "Save changes" : "Add vendor"}
        </Button>
        <Button
          variant="outline"
          onClick={() => router.back()}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs uppercase tracking-widest text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
```

> The form intentionally omits the `links` field for v1. Add via the Convex dashboard or extend the form post-MVP. (Documented here so it doesn't look like an oversight.)

- [ ] **Step 2: Lint and typecheck**

Run: `pnpm lint && pnpm typecheck`

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/vendor-form.tsx
git commit -m "Add VendorForm shared add/edit component"
```

---

## Task 11: New vendor page

**Files:**
- Create: `src/app/(admin)/admin/vendors/new/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
import Link from "next/link";
import { VendorForm } from "@/components/admin/vendor-form";

export default function NewVendorPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/vendors"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to vendors
        </Link>
        <h1 className="font-heading text-3xl mt-2">Add vendor</h1>
      </div>
      <VendorForm />
    </div>
  );
}
```

- [ ] **Step 2: Browser verify**

Navigate to `http://localhost:3000/admin/vendors/new`. Expected: form renders. Fill in name + category + price, click "Add vendor". Expected: toast "Vendor added", redirect to `/admin/vendors/<id>` (which 404s until Task 12), and the row appears on `/admin/vendors`.

- [ ] **Step 3: Lint, typecheck, commit**

```bash
pnpm lint && pnpm typecheck
git add src/app/(admin)/admin/vendors/new/page.tsx
git commit -m "Add /admin/vendors/new page"
```

---

## Task 12: Vendor detail page + detail component

**Files:**
- Create: `src/components/admin/vendor-detail.tsx`
- Create: `src/app/(admin)/admin/vendors/[id]/page.tsx`

- [ ] **Step 1: Create the detail component**

```tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/convex";
import type { Doc, Id } from "@/lib/convex";
import { Button } from "@/components/ui/button";
import {
  categoryLabel,
  includeLabel,
  PRICE_UNIT_LABELS,
  STATUS_LABELS,
} from "@/lib/vendor-categories";
import { VendorForm } from "./vendor-form";

const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

type Vendor = Doc<"vendors">;

export function VendorDetail({ id }: { id: Id<"vendors"> }) {
  const vendor = useQuery(api.vendors.get, { id });
  const softDelete = useMutation(api.vendors.softDelete);
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  if (vendor === undefined) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (vendor === null) {
    return (
      <p className="text-sm text-muted-foreground">Vendor not found.</p>
    );
  }

  if (editing) {
    return <VendorForm existing={vendor} />;
  }

  async function onDelete() {
    if (!confirm(`Delete ${vendor.name}? This is reversible.`)) return;
    try {
      await softDelete({ id });
      toast.success("Vendor deleted");
      router.push("/admin/vendors");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <span className="bg-muted px-2 py-0.5 rounded-full">
              {categoryLabel(vendor.category, vendor.customCategory)}
            </span>
            <span className="bg-muted px-2 py-0.5 rounded-full">
              {STATUS_LABELS[vendor.status]}
            </span>
          </div>
          <h1 className="font-heading text-3xl mt-2">{vendor.name}</h1>
          {vendor.location && (
            <p className="text-sm text-muted-foreground mt-1">
              {vendor.location}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button variant="destructive" size="sm" onClick={onDelete}>
            Delete
          </Button>
        </div>
      </div>

      <section className="rounded-lg border border-border bg-card p-4 space-y-2">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
          Pricing
        </h2>
        <p className="text-2xl font-heading tabular-nums">
          {vendor.priceTotal != null
            ? USD.format(vendor.priceTotal)
            : "—"}
          {vendor.priceUnit && (
            <span className="ml-2 text-sm text-muted-foreground font-sans">
              {PRICE_UNIT_LABELS[vendor.priceUnit]}
            </span>
          )}
        </p>
        {vendor.includes.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {vendor.includes.map((t) => (
              <span
                key={t}
                className="text-[11px] bg-[var(--accent)]/10 text-[var(--accent)] px-2 py-0.5 rounded"
              >
                {includeLabel(t)}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card title="Contact">
          <DefList
            entries={[
              ["Name", vendor.contactName],
              ["Phone", vendor.phone],
              ["Email", vendor.email],
              ["Website", vendor.website],
            ]}
          />
        </Card>
        <Card title="Payments">
          <DefList
            entries={[
              [
                "Deposit",
                vendor.depositAmount != null
                  ? `${USD.format(vendor.depositAmount)}${
                      vendor.depositPaidAt != null ? " · paid" : ""
                    }`
                  : undefined,
              ],
              [
                "Final due",
                vendor.finalDueAt
                  ? new Date(vendor.finalDueAt).toLocaleDateString()
                  : undefined,
              ],
              ["Final paid", vendor.finalPaidAt ? "yes" : undefined],
            ]}
          />
        </Card>
      </section>

      {vendor.notes && (
        <Card title="Notes">
          <pre className="whitespace-pre-wrap font-sans text-sm text-foreground">
            {vendor.notes}
          </pre>
        </Card>
      )}

      {(vendor.pros || vendor.cons) && (
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {vendor.pros && (
            <Card title="Pros">
              <pre className="whitespace-pre-wrap font-sans text-sm">
                {vendor.pros}
              </pre>
            </Card>
          )}
          {vendor.cons && (
            <Card title="Cons">
              <pre className="whitespace-pre-wrap font-sans text-sm">
                {vendor.cons}
              </pre>
            </Card>
          )}
        </section>
      )}

      {vendor.links.length > 0 && (
        <Card title="Links">
          <ul className="space-y-1 text-sm">
            {vendor.links.map((l, i) => (
              <li key={i}>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--accent)] underline underline-offset-2"
                >
                  {l.label || l.url}
                </a>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p>
        <Link
          href="/admin/vendors"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to vendors
        </Link>
      </p>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-2">
      <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
        {title}
      </h2>
      {children}
    </div>
  );
}

function DefList({
  entries,
}: {
  entries: Array<[string, string | undefined]>;
}) {
  const visible = entries.filter(([, v]) => v && v.trim());
  if (visible.length === 0) {
    return <p className="text-sm text-muted-foreground">—</p>;
  }
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
      {visible.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="text-foreground break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
```

- [ ] **Step 2: Create the detail page**

```tsx
// src/app/(admin)/admin/vendors/[id]/page.tsx
import { VendorDetail } from "@/components/admin/vendor-detail";
import type { Id } from "@/lib/convex";

export default async function VendorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <VendorDetail id={id as Id<"vendors">} />;
}
```

- [ ] **Step 3: Browser verify**

Navigate to `/admin/vendors`, click the vendor row you created. Expected: detail page shows pricing, contact, payments cards; Edit toggles to the form; Delete confirms then redirects back with the row gone.

- [ ] **Step 4: Lint, typecheck, commit**

```bash
pnpm lint && pnpm typecheck
git add src/components/admin/vendor-detail.tsx src/app/\(admin\)/admin/vendors/\[id\]/page.tsx
git commit -m "Add /admin/vendors/[id] detail page"
```

---

## Task 13: Bulk-add form + page

**Files:**
- Create: `src/components/admin/vendor-bulk-form.tsx`
- Create: `src/app/(admin)/admin/vendors/bulk/page.tsx`

- [ ] **Step 1: Create the bulk form**

```tsx
// src/components/admin/vendor-bulk-form.tsx
"use client";

import { useState, useTransition } from "react";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/convex";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const SAMPLE = `[
  {
    "name": "Iris & Oak Studio",
    "category": "photographer",
    "status": "considering",
    "priceTotal": 4800,
    "priceUnit": "flat",
    "website": "https://example.com",
    "notes": "8hr, 2 shooters, prints, online gallery"
  }
]`;

export function VendorBulkForm() {
  const router = useRouter();
  const bulkAdd = useMutation(api.vendors.bulkAdd);
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    inserted: number;
    errors: Array<{ index: number; message: string }>;
  } | null>(null);

  function submit() {
    setResult(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      toast.error(
        `JSON parse error: ${err instanceof Error ? err.message : err}`,
      );
      return;
    }
    if (!Array.isArray(parsed)) {
      toast.error("Expected a JSON array of vendor objects");
      return;
    }

    startTransition(async () => {
      try {
        // Cast through unknown — server-side schema validation is the source
        // of truth; we just hand the parsed array over.
        const res = await bulkAdd({ rows: parsed as never });
        setResult(res);
        if (res.errors.length === 0) {
          toast.success(`Added ${res.inserted} vendor(s)`);
          router.push("/admin/vendors");
        } else {
          toast.message(
            `Added ${res.inserted}, ${res.errors.length} failed — see details below`,
          );
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Bulk add failed");
      }
    });
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <p className="text-sm text-muted-foreground">
        Paste a JSON array of vendor objects. Each object accepts the same
        fields as a single add. Validation runs per-row; partial successes are
        kept.
      </p>

      <Textarea
        rows={18}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={SAMPLE}
        className="font-mono text-xs"
      />

      <div className="flex gap-2">
        <Button onClick={submit} disabled={pending || !text.trim()}>
          Add all
        </Button>
        <Button
          variant="outline"
          onClick={() => setText(SAMPLE)}
          disabled={pending}
        >
          Insert sample
        </Button>
      </div>

      {result && result.errors.length > 0 && (
        <div className="rounded-lg border border-[var(--status-no)]/50 bg-[var(--status-no)]/5 p-4 text-sm">
          <h3 className="font-medium mb-2">
            {result.inserted} inserted · {result.errors.length} failed
          </h3>
          <ul className="space-y-1">
            {result.errors.map((e) => (
              <li key={e.index} className="font-mono text-xs">
                row {e.index}: {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create the bulk page**

```tsx
// src/app/(admin)/admin/vendors/bulk/page.tsx
import Link from "next/link";
import { VendorBulkForm } from "@/components/admin/vendor-bulk-form";

export default function VendorBulkPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/vendors"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to vendors
        </Link>
        <h1 className="font-heading text-3xl mt-2">Bulk add vendors</h1>
      </div>
      <VendorBulkForm />
    </div>
  );
}
```

- [ ] **Step 3: Browser verify**

Navigate to `/admin/vendors/bulk`. Click "Insert sample", then "Add all". Expected: toast "Added 1 vendor(s)" and redirect to the list with the row present. Try pasting `[ {"name": "Bad"} ]` (missing required category). Expected: error toast / errors panel with row 0 explaining the schema validation failure.

- [ ] **Step 4: Lint, typecheck, commit**

```bash
pnpm lint && pnpm typecheck
git add src/components/admin/vendor-bulk-form.tsx src/app/\(admin\)/admin/vendors/bulk/page.tsx
git commit -m "Add /admin/vendors/bulk page for paste-JSON adds"
```

---

## Task 14: Add the `weddingBudget` input to settings

**Files:**
- Modify: `src/app/(admin)/admin/settings/page.tsx`

- [ ] **Step 1: Add the state + field**

In `src/app/(admin)/admin/settings/page.tsx`:

**(a)** Add a new edit state hook alongside the existing ones (after `venueCapacityEdit`):

```ts
  const [weddingBudgetEdit, setWeddingBudgetEdit] =
    useState<Edited<string>>(null);
```

**(b)** Add the derived value alongside `venueCapacity`:

```ts
  const weddingBudget =
    weddingBudgetEdit ??
    (settings?.weddingBudget != null
      ? String(settings.weddingBudget)
      : "");
```

**(c)** Inside `save()`, after the `capacityNumber` block, add a parallel block:

```ts
        const budgetRaw = weddingBudget.trim();
        const budgetParsed = budgetRaw
          ? Number.parseInt(budgetRaw, 10)
          : null;
        const budgetNumber =
          budgetParsed != null &&
          Number.isFinite(budgetParsed) &&
          budgetParsed >= 0
            ? budgetParsed
            : null;
        if (budgetRaw && budgetNumber === null) {
          toast.error("Wedding budget must be a non-negative whole number");
          return;
        }
```

**(d)** Add `setSetting` for the budget inside the existing `Promise.all([...])`, alongside the other setters:

```ts
          setSetting({
            key: "weddingBudget",
            value:
              budgetNumber != null && Number.isFinite(budgetNumber)
                ? budgetNumber
                : null,
          }),
```

**(e)** Clear the edit state in the success path:

```ts
        setWeddingBudgetEdit(null);
```

**(f)** Render the new section after the existing `Venue capacity` section (and before `Your notifications`):

```tsx
      <section className="space-y-4">
        <h2 className="font-heading text-xl">Wedding budget</h2>
        <div className="space-y-1 max-w-xs">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">
            Total budget (USD)
          </Label>
          <Input
            type="number"
            min={0}
            value={weddingBudget}
            onChange={(e) => setWeddingBudgetEdit(e.target.value)}
            placeholder="e.g. 45000"
          />
          <p className="text-xs text-muted-foreground">
            Used by the budget bar on the vendors page. Leave blank to show
            committed spend without a target.
          </p>
        </div>
      </section>
```

- [ ] **Step 2: Browser verify**

Navigate to `/admin/settings`. Expected: new "Wedding budget" section appears. Enter `45000` and save. Visit `/admin/vendors` — BudgetBar should now show `Budget: $45,000` with the remaining amount.

Clear the field and save. BudgetBar header reverts to the "Set wedding budget →" link.

- [ ] **Step 3: Lint, typecheck, commit**

```bash
pnpm lint && pnpm typecheck
git add src/app/\(admin\)/admin/settings/page.tsx
git commit -m "Add weddingBudget input to admin settings"
```

---

## Task 15: End-to-end smoke pass

**Files:** none.

- [ ] **Step 1: Full smoke test in the browser**

Run: `pnpm dev`. Walk through:

1. Visit `/admin` — guest list still loads (no regression).
2. Click **Vendors** in nav. Empty state visible. BudgetBar shows zeros and "Set wedding budget →".
3. Click **+ Add vendor**. Add `Sunset Manor`, category `venue`, status `chosen`, price `20000` flat, includes `catering`, `bar`, `linens`. Save.
4. Back on `/admin/vendors`: the row appears under `Venue`. A faded "— covered by Sunset Manor —" stub appears under `Catering` and `Bar` sections.
5. Add a second photographer with `priceTotal: 4800`, status `considering`. BudgetBar shows `$20,000 committed · up to $24,800 if all considering are chosen`.
6. Go to `/admin/settings`, set budget to `30000`. BudgetBar now shows `Budget: $30,000`, `$5,200 remaining`.
7. Edit Sunset Manor → `priceTotal: 26000`. BudgetBar: still under, but near (≥90% projected if the photographer flips to chosen). Color band shifts amber.
8. Bump Sunset Manor → `priceTotal: 32000`. BudgetBar over budget — red overflow band and warning text appear.
9. Visit `/admin/vendors/bulk`. Insert sample, "Add all". The Iris & Oak photographer is added.
10. Click into any vendor, hit **Delete**. Confirm. Row vanishes from the list.

- [ ] **Step 2: Lint + typecheck final**

Run: `pnpm lint && pnpm typecheck && pnpm build:next`
Expected: all exit 0. The build verifies the `(admin)` route group still produces a valid runtime.

- [ ] **Step 3: Push the branch**

```bash
git push -u origin feature/vendor-management
```

- [ ] **Step 4: Open the PR via your usual flow**

If using `gh`:

```bash
gh pr create --title "Vendor management (admin)" --body "$(cat <<'EOF'
## Summary
- Adds `/admin/vendors` — list grouped by category with status pills, includes-tag chips, and a budget bar.
- New `vendors` Convex table with queries, mutations, and a `bulkAdd` for paste-JSON imports.
- Adds `weddingBudget` to the existing admin settings page.

## Test plan
- [ ] Add a chosen venue with `includes: ["catering", "bar"]` — bundled stubs appear in those category sections.
- [ ] Adjust budget at `/admin/settings` — BudgetBar reflects the change with appropriate color states (under/near/over).
- [ ] `/admin/vendors/bulk` round-trip with both a valid sample and an invalid row.

Spec: `docs/superpowers/specs/2026-05-17-vendor-management-design.md`
Plan: `docs/superpowers/plans/2026-05-17-vendor-management-plan.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review notes

**Spec coverage check (post-write):**

- `vendors` schema with all listed fields, indexes — Task 1 ✓
- `CATEGORIES`, `INCLUDES`, `BUNDLED_TAG_TO_CATEGORY` — Task 2 ✓
- Queries (`list`, `get`, `rollups`) including per-head math against confirmed RSVPs — Task 3 ✓
- Mutations (`add`, `update`, `setStatus`, `softDelete`, `bulkAdd`) — Task 4 ✓ (plus `restore` for symmetry with guests)
- Admin nav link — Task 5 ✓
- BudgetBar component mirroring CapacityBar, three states — Task 6 ✓
- List grouped by category with bundled-stub rows — Tasks 7 & 9 ✓
- Toolbar (search/filter/sort) — Task 8 ✓ (sort omitted; data is already sorted by category+name server-side, which the spec describes)
- VendorForm + new page — Tasks 10–11 ✓
- VendorDetail + detail page — Task 12 ✓
- Bulk JSON paste form — Task 13 ✓
- `weddingBudget` settings input — Task 14 ✓
- Smoke pass — Task 15 ✓

**Known intentional deviations from the spec:**

- The spec lists a "Sort" select in the toolbar; the plan omits it. The server query already sorts by `category` then `name`, and the visible grouping by category makes client-side sort options low-value for v1. Easy to add later if needed.
- `links[]` is captured in the schema and rendered on detail, but is not editable in the form for v1 — the user can add via Convex dashboard. Adding a "Links" editor is straightforward but low-priority and would inflate Task 10.
- Testing section of the spec is deferred — see "Testing posture" at the top of this plan.

**Sort task ordering:** every task results in a passing build. Tasks 3 and 4 share a commit, called out explicitly in Task 4 Step 4. All other tasks are independently committable.

**Type consistency check:** the rollups return shape (`committed`, `consideringTotal`, `confirmedHeadcount`, `upcoming30d`) is consistent between Task 3's definition, Task 6's BudgetBar usage, and Task 7's VendorList usage.

# Admin Landing Page — Design Spec

**Date:** 2026-05-27
**Author:** Andrew (with Claude as collaborator)
**Status:** Approved — pending implementation plan

## Context

Today `/admin` renders the guest list. There's no real admin home — Andrew has nowhere to see "how's everything looking" at a glance, and the only place to start an action is wherever that action lives. The vendor-appointments brainstorm explicitly deferred a cross-vendor "upcoming appointments" rollup to this brainstorm.

This spec replaces `/admin` with a dashboard landing and moves the guest list to `/admin/guests`, so the URL space matches what each page actually shows.

Mobile-first: Andrew does most admin from his phone. Everything stacks single-column ≤ md.

## Decisions

| Concern | Choice | Why |
|---|---|---|
| `/admin` content | New landing dashboard, 5 zones | Replaces "guest list" — see Section "Public — landing layout" |
| Guests route | Move to `/admin/guests` | Matches existing nested routes (`/admin/guests/new`, `/admin/guests/[id]`) |
| Zones at launch | Countdown · Quick actions · Guests · Money · Upcoming appointments | User-picked at brainstorm |
| Quick actions | `+ Guest` · `+ Appointment` · `+ Vendor` · `+ Registry pick` | Covers the most common one-tap entry points |
| "Make appointment" UX | New `GlobalAppointmentDialog` — vendor picker then the existing appointment form body | Inline; no navigation; reuses existing form |
| Layout (desktop) | Countdown full-width → quick-action row → 2-up grid (Guests · Money) → Upcoming appointments full-width | Most-checked info above the fold; appointments get full width for readable rows |
| Layout (mobile) | Everything stacked single column, same order | Stacked is universally readable |
| Countdown data | Reads `weddingDate` from `publicSettings` | Already exposed; no schema work |
| Guests snapshot | Reuses existing `RollupChips` + `CapacityBar` inside a card | DRY; same data shape as on the guests page |
| Money snapshot | Reuses existing `BudgetBar` derived data; "Due soon" reuses `api.vendors.rollups.upcoming30d` | Already shipped |
| Upcoming appointments | New cross-vendor query `vendorAppointments.listUpcomingAll(limit)` | Requires one new index |
| New index | `by_start_status` on `vendorAppointments`: `[deletedAt, status, startAt]` | Was anticipated by the appointments spec |
| Auth | `/admin/guests` inherits the existing `(admin)` layout's gate | No new auth wiring |

## Architecture

```
src/app/(admin)/admin/
├── page.tsx            ← NEW: landing dashboard (was: guest list)
├── guests/
│   ├── page.tsx        ← NEW: guest list (moved from /admin)
│   ├── [id]/page.tsx   (unchanged)
│   └── new/page.tsx    (unchanged)
└── (other routes unchanged)

src/components/admin/
├── landing/                          ← NEW directory
│   ├── countdown-hero.tsx
│   ├── quick-actions.tsx
│   ├── guests-card.tsx               (wraps existing RollupChips + CapacityBar)
│   ├── money-card.tsx                (wraps BudgetBar + DueSoonList)
│   ├── due-soon-list.tsx
│   └── upcoming-appointments-card.tsx
├── global-appointment-dialog.tsx     ← NEW (vendor picker → form body)
├── appointment-form.tsx              MODIFY: export Body as AppointmentFormBody
└── (other components unchanged)

convex/
├── schema.ts                         MODIFY: add by_start_status index
└── vendorAppointments.ts             MODIFY: add listUpcomingAll query
```

No route shuffling beyond `/admin` ↔ `/admin/guests`. No new convex tables.

## Public — landing layout

The page renders inside the existing `(admin)` layout (header + nav + `AdminShell`). The body of `/admin/page.tsx`:

1. **CountdownHero** — full-width blush gradient card. Big number ("127"), small "Days until" label, italic date line ("Sat, Sep 4 2027"). If `weddingDate` is unset, render the same card with `—` and "Wedding date not set — pick one in Settings." If the date is in the past, show `0` and "Today's the day!" / past-date message.
2. **QuickActions** — grid of 4 buttons. `+ Guest` (links to `/admin/guests/new`), `+ Appointment` (opens `GlobalAppointmentDialog`), `+ Vendor` (links to `/admin/vendors/new`), `+ Registry pick` (links to `/admin/products/new`). 2×2 on mobile, single row on `sm+`. Each button is a card-style affordance ≥64 px tall with emoji icon + label.
3. **GuestsCard** — card with heading "Guests" and a "View →" link to `/admin/guests`. Body wraps the existing `RollupChips` and `CapacityBar` components. No data plumbing — they already query their own data.
4. **MoneyCard** — card with heading "Money" and a "Vendors →" link to `/admin/vendors`. Body wraps the existing `BudgetBar`-derived data (committed / paid / outstanding rows + budget bar), then a "Due soon" sub-list rendered by a new `DueSoonList` reading from `api.vendors.rollups.upcoming30d` (already returns the right shape — name, dueAt, amount). Limit to first 5.
5. **UpcomingAppointmentsCard** — card with heading "Upcoming appointments." Each row: date+time, vendor name + appointment notes preview, full-width "Add to Google Cal" anchor (uses the existing `buildGoogleCalendarUrl` helper). Empty state: "No upcoming appointments. Schedule one from any vendor's page or use **+ Appointment** above."

### Layout grid
- Mobile / `< md`: every zone stacks in a single column, order as above.
- `md+`: Countdown full-width, QuickActions row full-width, then a 2-column grid for Guests + Money, then UpcomingAppointments full-width.

### What it does NOT have (deliberately)
- Activity feed / recent RSVPs — guests page already shows new RSVPs.
- Unread messages widget — the admin nav already shows an unread badge via `MessagesNavLink`.
- Notifications panel — Resend already emails on RSVP.
- Calendar grid / month view — explicit YAGNI.

## Admin UX details

### CountdownHero
Reads `api.settings.publicSettings()["weddingDate"]` (string `YYYY-MM-DD`). Computes whole-day diff in local time. Always integer days. Renders the gradient card from the mockup.

### QuickActions
4 buttons. The first three are anchors (`<Link>`). The fourth (`+ Appointment`) opens `GlobalAppointmentDialog`.

### GlobalAppointmentDialog
New component. Two states:

- **Pick state** — combobox/search-as-you-type listing all non-deleted vendors via the existing `api.vendors.list()`. Choosing a vendor advances to form state. Cancel closes.
- **Form state** — mounts the existing form body (refactored out of `AppointmentFormDialog` as exported `AppointmentFormBody`) with the chosen `vendorId`. Save behaves identically to per-vendor add. After save, dialog closes and a toast says "Saved — see appointment on <vendor name>."

A small "← change vendor" link in the dialog header during form state goes back to pick state without losing user-entered field values for date/time/notes (keep them in dialog-level state during the back-and-forth).

### DueSoonList
Renders up to 5 rows from `api.vendors.rollups().upcoming30d`. Each row: vendor name + "Final · N days" + amount. Links each row to `/admin/vendors/[id]`. If list is empty, render nothing (the rest of MoneyCard still shows).

### UpcomingAppointmentsCard
Reads `api.vendorAppointments.listUpcomingAll({ limit: 5 })`. Each row links the vendor name to `/admin/vendors/[id]`. Renders the "Add to Google Cal" button just like the per-vendor card does (full-width anchor using `buildGoogleCalendarUrl`).

## Data — new Convex query + index

### Schema change

Add a second index to `vendorAppointments`:

```ts
.index("by_start_status", ["deletedAt", "status", "startAt"])
```

(Kept alongside the existing `by_vendor` index.)

### `listUpcomingAll` query

```ts
export const listUpcomingAll = query({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const now = Date.now();
    const rows = await ctx.db
      .query("vendorAppointments")
      .withIndex("by_start_status", (q) =>
        q
          .eq("deletedAt", undefined)
          .eq("status", "scheduled")
          .gte("startAt", now),
      )
      .order("asc")
      .take(args.limit);

    // Join vendor names so the card doesn't need a second hop.
    const vendorIds = Array.from(new Set(rows.map((r) => r.vendorId)));
    const vendorMap = new Map<string, string>();
    for (const vid of vendorIds) {
      const v = await ctx.db.get(vid);
      if (v) vendorMap.set(vid, v.name);
    }
    return rows.map((r) => ({
      ...r,
      vendorName: vendorMap.get(r.vendorId) ?? "(unknown vendor)",
    }));
  },
});
```

Returns at most `limit` rows (scheduled + future) with each row augmented by `vendorName`. Excludes soft-deleted rows and non-`scheduled` statuses.

## Route migration

### Move `/admin/page.tsx` content to `/admin/guests/page.tsx`

The current `/admin/page.tsx` is 20 lines (a heading + `<RollupChips/>` + `<CapacityBar/>` + `<GuestTable/>`). Copy it verbatim into a new `src/app/(admin)/admin/guests/page.tsx` and replace `/admin/page.tsx` with the new landing.

### Update internal links to `/admin`

Eight files reference `/admin` today:

| File | Today | Target after migration |
|---|---|---|
| `src/app/(admin)/admin/layout.tsx:27` | logo links to `/admin` | **stays** `/admin` (the landing is now the admin home) |
| `src/app/page.tsx:74` (public footer) | "Admin" link | **stays** `/admin` |
| `src/components/admin/admin-nav.tsx:25,69` | "Guests" tab in desktop + drawer | **changes** to `/admin/guests` |
| `src/app/(admin)/admin/import/page.tsx:117` | "back to guest list" | **changes** to `/admin/guests` |
| `src/app/(admin)/admin/settings/page.tsx:193` | "back to guest list" | **changes** to `/admin/guests` |
| `src/app/(admin)/admin/guests/[id]/page.tsx:33,45` | back-link | **changes** to `/admin/guests` |
| `src/app/(admin)/admin/guests/new/page.tsx:20` | back-link | **changes** to `/admin/guests` |
| `src/components/admin/invitations-view.tsx:44` | "back to admin" anchor | **stays** `/admin` (the landing is fine as the post-print destination) |

Each of these needs a deliberate decision — the implementer should read the surrounding text on each link to make sure it still reads correctly after the change.

### Browser history / bookmarks
Anyone who bookmarked `/admin` for "the guest list" will land on the new dashboard instead. That's the right outcome — the dashboard's first card is "Guests" with a one-tap "View →" to the new URL. No redirect needed.

## Mobile-first specifics

- All cards span full width below `md`. Quick actions are 2×2 on mobile, 4-up on `sm+`.
- Touch targets ≥40 px (quick-action buttons are 64+, "Add to Google Cal" buttons are min 40 px tall).
- Dialog (GlobalAppointmentDialog) renders centered on mobile — same pattern as the existing `AppointmentFormDialog`.
- Countdown number scales from `5xl` mobile to `7xl` desktop.

## Out of scope (explicitly)

- Activity feed (new RSVPs, recent changes log).
- Calendar / month view.
- Customizable dashboard (rearranging or hiding cards).
- Cross-couple support / multiple weddings.
- Per-admin home preferences.
- Server-side prerender (whole admin section stays `force-dynamic` per existing layout).
- New auth roles.
- Switching guest list to a different default route name (e.g. `/admin/rsvps`).

## Phased build

Single cohesive feature. Suggested order:

- **T1** — Add `by_start_status` index to `vendorAppointments` (schema-only change).
- **T2** — Add `listUpcomingAll` query.
- **T3** — Move guest-list content from `/admin/page.tsx` to `/admin/guests/page.tsx`; replace `/admin/page.tsx` with a temporary "Landing — coming next" placeholder so nothing 404s during migration.
- **T4** — Update the 8 internal links to `/admin` per the migration table (one commit).
- **T5** — Build `CountdownHero` component.
- **T6** — Build `QuickActions` component (with the appointment quick-action firing a state hook only; dialog wired in T8).
- **T7** — Build `GuestsCard` and `MoneyCard` (+ `DueSoonList` helper).
- **T8** — Refactor `appointment-form.tsx` to export `AppointmentFormBody`; build `GlobalAppointmentDialog`; wire QuickActions' `+ Appointment` to it.
- **T9** — Build `UpcomingAppointmentsCard`.
- **T10** — Compose landing page (`/admin/page.tsx`) from the components; remove placeholder.
- **T11** — Final verification (typecheck, lint, headed-browser smoke at mobile + desktop widths).

## Implementation plan

See the corresponding plan in `docs/superpowers/plans/` once written.

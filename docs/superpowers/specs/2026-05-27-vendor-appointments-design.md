# Vendor Appointments — Design Spec

**Date:** 2026-05-27
**Author:** Andrew (with Claude as collaborator)
**Status:** Approved — pending implementation plan

## Context

Andrew tracks vendors in `/admin/vendors` but has nowhere to record meetings (first calls, site visits, tastings, sign-offs). He wants to log appointments per vendor and, when scheduling one, generate an "Add to Google Calendar" link so the event lands in his calendar without OAuth, API keys, or any sync infrastructure.

He works primarily on his phone, so the appointment UI must be mobile-first (stacked cards, OS-native pickers, ≥40px touch targets).

A cross-vendor "Upcoming appointments" rollup was discussed and **deferred** to a separate admin-landing brainstorm. `/admin` today renders the guests page; designing a proper landing page is its own scope.

## Decisions

| Concern | Choice | Why |
|---|---|---|
| Cardinality | Many appointments per vendor (separate `vendorAppointments` table) | Real workflows have first call → site visit → tasting → sign-off |
| Surfaces | Vendor detail page only (new "Appointments" section) | Cross-vendor rollup deferred to admin-landing brainstorm |
| Calendar integration | Templated `calendar.google.com/render?action=TEMPLATE` URL | Zero infra, one click, works because admin is signed into Google in the same browser |
| Fields | `startAt` + `endAt` + `location` + `notes` + `status` | User-picked at brainstorm; covers actual scheduling needs |
| Time precision | Date + start time + end time (end defaults to start + 1h) | Calendar exports need an end |
| Status | `scheduled` · `completed` · `cancelled` (free toggle, not state machine) | Lets admin re-mark mistakes without ceremony |
| Past appointments | Shown in collapsed "Past · Done" band; never auto-completed | Admin owns the state; auto-flipping would hide cancellations |
| Past-but-scheduled hint | Inline "Past — mark done?" italic note | Surfaces the case without changing data |
| Mobile layout | Card per appointment; action row with full-width Google Cal button + 40px icon buttons | Touch-friendly density; primary action gets the most width |
| Form layout | Bottom-sheet style on mobile / dialog on desktop; native OS pickers for date/time | Reuses platform input affordances |
| OAuth | Out of scope | Significant work for ~5 users; templated URL covers the use case |
| `.ics` download | Out of scope | Add later if Apple/Outlook users emerge |
| Recurring | Out of scope | Each appointment is one occurrence |
| Reminders / notifications | Out of scope | Google Calendar handles it once event is added |

## Architecture

```
Vendor detail page (/admin/vendors/[id])
├─ existing header + status/category/pricing/contacts
└─ NEW Appointments section
   ├─ "+ Add" button → AppointmentForm (sheet/dialog)
   ├─ Upcoming list (status=scheduled AND startAt >= now)
   └─ Past · Done collapsible band (everything else)

         │
         ▼
   Convex
   ├─ schema: vendorAppointments (new table)
   └─ functions: queries, mutations, no actions

         │
         ▼
   Google Calendar templated URL — pure helper, no network from us
```

## Data model

### `vendorAppointments` table

```ts
vendorAppointments: defineTable({
  vendorId: v.id("vendors"),
  startAt: v.number(),                       // epoch ms (UTC)
  endAt: v.number(),                         // epoch ms (UTC); >= startAt
  location: v.optional(v.string()),          // free text
  notes: v.optional(v.string()),
  status: v.union(
    v.literal("scheduled"),
    v.literal("completed"),
    v.literal("cancelled"),
  ),
  createdAt: v.number(),
  createdBy: v.string(),
  updatedAt: v.number(),
  deletedAt: v.optional(v.number()),
})
  .index("by_vendor", ["vendorId", "deletedAt", "startAt"])
```

### Why one index

The per-vendor query is the only access pattern in scope. `by_vendor` is composed as `[vendorId, deletedAt, startAt]` so we can:
- Scan a single vendor's non-deleted appointments in `startAt` order in one index range.
- Filter to upcoming vs past in memory on the small result set (always ≤ a few dozen per vendor).

When the admin-landing brainstorm later adds a cross-vendor rollup, it will add a second index `by_start_status` — out of scope here.

### Validation (admin mutations)
- `endAt >= startAt` (clamp or reject? — reject with a friendly error)
- `status` is one of the three literals (enforced by `v.union`)
- All string fields trimmed; empty strings become `undefined`

## Admin UX — `/admin/vendors/[id]`

A new **Appointments** section, inserted between the existing details and the existing payments/notes sections (concrete placement determined when wiring it up, but it lives near the bottom of the vendor detail content).

### Section header
- `h2`-level "Appointments" (matches sibling section headers)
- "+ Add" button on the right; full-width tap target on mobile, compact on desktop

### Empty state
- "No appointments yet. Schedule one to keep the history straight."

### Upcoming cards
Renders all appointments where `status === "scheduled"` and `startAt >= Date.now()`, sorted ascending by `startAt`. Each card is a self-contained block:

- **Top row:** date+time (left) · status badge (right)
- **Location** italicized, one line
- **Notes** (truncated to 3 lines with line-clamp; full text on edit)
- **Action row** (mobile: full-width Google Cal + 40px icon buttons):
  - **Add to Google Cal** (anchor → templated URL in new tab)
  - **Edit** (icon button)
  - **Delete** (icon button, confirms)

### Past · Done band
Renders everything else (any status with past `startAt`, plus any `completed`/`cancelled` regardless of time). Collapsed by default; toggle reveals the cards, same layout but 75% opacity.

When a card here is still `status === "scheduled"` (i.e., a past meeting nobody flipped), show an italic muted line **"Past — mark done?"** under the notes. Clicking the status badge cycles `scheduled → completed → cancelled → scheduled` so it's one tap to resolve.

### Status chip = quick toggle
Anywhere a status badge appears in the timeline, tapping/clicking it cycles to the next status. Free toggle (not a state machine), to allow undoing mistakes. Visual feedback via toast: "Marked as completed."

### Add / edit form

Renders in a sheet on mobile, dialog on desktop. Fields:

- **Date** — `<input type="date">` (native OS picker on mobile)
- **Start time** — `<input type="time">` (native OS picker)
- **End time** — `<input type="time">` (defaults to start + 1h; blank means "use default")
- **Location** — `<input type="text">` (placeholder: "At venue / Zoom / phone…")
- **Notes** — `<textarea>` (placeholder: "Agenda, links, anything you want…")
- **Status** — three-pill chooser (Scheduled / Completed / Cancelled); defaults to `scheduled` on add

On save:
- Combine date + start time → `startAt` (local timezone → epoch ms)
- Combine date + end time (or start + 1h) → `endAt`
- If `endAt < startAt`, toast "End time must be after start" and don't save
- Mutation persists row; sheet closes; appears at correct slot in the timeline

## Google Calendar export

A pure helper `buildGoogleCalendarUrl(appointment, vendorName)` in `src/lib/google-calendar.ts` that returns a URL of the form:

```
https://calendar.google.com/calendar/render
  ?action=TEMPLATE
  &text=<encoded vendor name + " meeting">
  &dates=<startUTC>/<endUTC>
  &details=<encoded notes>
  &location=<encoded location>
```

Where:
- `startUTC` / `endUTC` are UTC strings in `YYYYMMDDTHHmmssZ` format (Google's TEMPLATE expects this exact shape)
- `text` defaults to `"<vendor name> meeting"` (admin can edit in Google Calendar before saving)
- Empty `details` / `location` are omitted from the query string

The "Add to Google Cal" button is a plain `<a href={url} target="_blank" rel="noopener">`. No mutation, no auth, no state.

Pure helper is easy to verify by hand — admin clicks the button on a test appointment and confirms the Google Calendar create-event screen opens prefilled.

## Mobile-specific affordances

This entire feature is built mobile-first. Specifics:

- **Touch targets:** all interactive elements ≥40×40 px (icon buttons, status chips, add button).
- **Layout:** appointment cards stack to a single column below `sm`. Action row uses `flex` with the Google Cal button getting `flex-1` so it stretches to fill, with edit/delete as fixed 40×40 buttons after it.
- **Date/time inputs:** native `<input type="date">` and `<input type="time">` so iOS/Android show their wheel pickers, not custom JS pickers.
- **Sheet vs dialog:** the form uses the existing `Drawer` primitive (already on the mobile admin nav) below `md`, and `Dialog` above. Same component shape, different surface.
- **No horizontal scroll:** all content fits 360 px width without scroll.

## Out of scope (explicitly)

- Cross-vendor "Upcoming appointments" rollup — deferred to admin-landing brainstorm.
- Full Google OAuth + two-way Calendar API sync.
- `.ics` download / Apple Calendar / Outlook support.
- Recurring appointments.
- Reminders or notifications from our side.
- Per-appointment audit log (the `updatedAt`/`updatedBy` snapshot is enough).
- Drag-reorder (sorting is purely temporal).
- Attendees list / inviting other admins to an appointment.

## Phased build

This is a single cohesive feature. Suggested task order:

- **T1** — Schema (`vendorAppointments` table + index)
- **T2** — Convex queries/mutations (list per vendor, get, add, update, setStatus, softDelete)
- **T3** — `buildGoogleCalendarUrl` helper (pure function)
- **T4** — `AppointmentCard` component (display only, with Google Cal anchor + status chip toggle)
- **T5** — `AppointmentForm` component (sheet/dialog body with date+time, location, notes, status)
- **T6** — `AppointmentsSection` component (orchestrator: list, empty state, add button, past collapse)
- **T7** — Mount on `/admin/vendors/[id]` page (`VendorDetail`)
- **T8** — Final verification (typecheck, lint, headed-browser smoke at mobile width)

## Implementation plan

See the corresponding plan in `docs/superpowers/plans/` once written.

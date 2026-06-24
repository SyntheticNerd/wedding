# Guest Priority (want-level) — Design

> Date: 2026-06-24 · Status: approved (requested by Andrew) · Scope: admin-only

## Problem

Andrew & Jewel need to triage the guest list against budget ($30k) and venue
capacity. They want to mark each guest by how much they actually want them there,
so they can see at a glance who's essential vs. who's an obligation invite — and
trim from the bottom if the numbers don't fit.

## The three levels

A guest's `priority` is one of three values, or unset (no opinion yet):

| Value        | Color  | Meaning (Andrew's words)              | UI label    |
|--------------|--------|---------------------------------------|-------------|
| `must_have`  | green  | "must haves"                          | Must-have   |
| `kind_of`    | yellow | "kind of want"                        | Kind of     |
| `obligated`  | red    | "don't want but feel obligated"       | Obligated   |
| _(unset)_    | —      | not yet triaged                       | —           |

Colors reuse existing status tokens so we add no new design vocabulary:
- green → `--status-yes` (sage green)
- yellow → `--status-offline` (amber)
- red → `--status-no` (dusty rose)

This is a **private planning signal** — never shown to guests. It lives only in
the admin guest list, never on any public/RSVP surface.

## Data model

Add one optional field to the `guests` table:

```ts
priority: v.optional(v.union(
  v.literal("must_have"),
  v.literal("kind_of"),
  v.literal("obligated"),
)),
```

Optional ⇒ all existing guests stay valid with no backfill. Production Convex
deploys on merge to `main` (Vercel `convex deploy`), so the field ships with the
PR; an additive optional field is backward-compatible.

## Backend (`convex/guests.ts`)

1. `priority` added to `guestFields` ⇒ flows through `create` and `update`.
   `update` writes `args.priority` directly so the value is **clearable** (set
   back to unset).
2. New `setPriority({ id, priority })` mutation — a cheap single-field patch for
   fast inline tagging from the table without re-sending the whole guest form.
   `priority` may be `null`/omitted to clear.
3. `bulkUpdate` patch gains an optional `priority` so a multi-select can be tagged
   at once.
4. `rollups` returns counts per level (`mustHave`, `kindOf`, `obligated`,
   `priorityUnset`) — cheap (the query already collects all guests) and directly
   answers "does our must-have list fit?".
5. Priority changes are recorded in the existing `rsvpAuditLog` (added to the
   audit-worthy field set) so "moved Aunt Carol must-have → obligated" is visible
   in a guest's History.

## UI

- **`guest-priority-badge.tsx`** — small colored dot + label; reused in table and form.
- **`guest-table.tsx`**
  - New **Priority** column (desktop) and badge on the mobile card.
  - New **inline picker** per row (the core ergonomic): a small popover/segmented
    control of the three colors + "clear", calling `setPriority`. Lets Andrew walk
    the list tagging people one tap each.
  - New **Priority filter** (all / must-have / kind of / obligated / untriaged).
  - CSV export gains a `priority` column.
- **`guest-form.tsx`** — a Priority select in the top grid (near Side).
- **`bulk-edit-dialog.tsx`** — a toggleable Priority field.

## Out of scope / notes

- No public-facing change. No RSVP-flow change.
- No test harness exists in this repo yet; this change is verified by `tsc`
  strict typecheck + manual admin walkthrough. (Adding a Convex test harness is
  tracked separately, not blocking this feature.)

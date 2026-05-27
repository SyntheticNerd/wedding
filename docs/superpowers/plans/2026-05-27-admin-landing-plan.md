# Admin Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `/admin` with a 5-zone landing dashboard (countdown · quick actions · guests · money · upcoming appointments) and move the guest list to `/admin/guests`.

**Architecture:** Reuses existing rollup components (`RollupChips`, `CapacityBar`, `BudgetBar`) inside new landing-only zone wrappers — no data plumbing changes. Adds one Convex index (`by_start_status` on `vendorAppointments`) and one cross-vendor query (`listUpcomingAll`). The "+ Appointment" quick action introduces a new `GlobalAppointmentDialog` that wraps a vendor picker around the existing appointment form body (which gets exported for reuse).

**Tech Stack:** Next.js 16 App Router (TypeScript strict), Convex 1.37, Clerk, shadcn/ui + Tailwind. No new dependencies.

**Reference docs:**
- Spec: `docs/superpowers/specs/2026-05-27-admin-landing-design.md`
- Existing reusable components: `src/components/admin/rollup-chips.tsx`, `capacity-bar.tsx`, `budget-bar.tsx`
- Existing dialog patterns: `src/components/admin/appointment-form.tsx` (keyed-body pattern reused here)
- `api.vendors.rollups()` already returns `upcoming30d: Array<{ id, name, dueAt, amount }>` (no schema change needed for Money's "Due soon")
- Verification cadence: project has no automated tests; verification is `pnpm typecheck && pnpm lint` per task, plus a headed-browser smoke at T11.

---

## File map

**Create:**
- `src/components/admin/landing/countdown-hero.tsx`
- `src/components/admin/landing/quick-actions.tsx`
- `src/components/admin/landing/guests-card.tsx`
- `src/components/admin/landing/money-card.tsx`
- `src/components/admin/landing/due-soon-list.tsx`
- `src/components/admin/landing/upcoming-appointments-card.tsx`
- `src/components/admin/global-appointment-dialog.tsx`
- `src/app/(admin)/admin/guests/page.tsx` (moved guest list)

**Modify:**
- `convex/schema.ts` — add `by_start_status` index
- `convex/vendorAppointments.ts` — add `listUpcomingAll` query
- `src/components/admin/appointment-form.tsx` — export the existing inner `Body` as `AppointmentFormBody`
- `src/app/(admin)/admin/page.tsx` — was guest list, becomes landing
- `src/components/admin/admin-nav.tsx` — "Guests" link points to `/admin/guests`
- Five internal back-links per the spec's migration table

---

## Task T1 — Schema: add `by_start_status` index

**Files:**
- Modify: `convex/schema.ts`

- [ ] **Step 1: Append the second index to `vendorAppointments`**

In `convex/schema.ts`, find the `vendorAppointments` block. It currently ends with:

```ts
  }).index("by_vendor", ["vendorId", "deletedAt", "startAt"]),
```

Change that line to chain a second index:

```ts
  })
    .index("by_vendor", ["vendorId", "deletedAt", "startAt"])
    .index("by_start_status", ["deletedAt", "status", "startAt"]),
```

- [ ] **Step 2: Regen + typecheck**

```bash
npx convex codegen --typecheck disable
pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add convex/schema.ts convex/_generated/
git commit -m "feat(admin-landing): add by_start_status index"
```

---

## Task T2 — `listUpcomingAll` query

**Files:**
- Modify: `convex/vendorAppointments.ts`

- [ ] **Step 1: Append the query at the bottom of the file (after `applyOgSnapshot`-style mutations, before the type exports)**

Open `convex/vendorAppointments.ts`. Find the `export type Appointment = ...` lines at the bottom. Immediately ABOVE those type exports, add:

```ts
/* ----------------------------------------------------------------------
   Cross-vendor query for the admin landing page
   -------------------------------------------------------------------- */

/**
 * Next N scheduled appointments across all vendors. Joins vendor names so
 * the caller doesn't need a second hop. Used by /admin landing.
 */
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

- [ ] **Step 2: Regen + typecheck**

```bash
npx convex codegen --typecheck disable
pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add convex/vendorAppointments.ts convex/_generated/
git commit -m "feat(admin-landing): listUpcomingAll cross-vendor query"
```

---

## Task T3 — Move guest list to `/admin/guests`, stub landing

**Files:**
- Create: `src/app/(admin)/admin/guests/page.tsx`
- Modify: `src/app/(admin)/admin/page.tsx`

The current `/admin/page.tsx` is the guest list. Move its contents to `/admin/guests/page.tsx` verbatim, then replace `/admin/page.tsx` with a temporary placeholder so the route doesn't 404 between T3 and T10.

- [ ] **Step 1: Create `src/app/(admin)/admin/guests/page.tsx` with the current `/admin/page.tsx` content**

```tsx
import { GuestTable } from "@/components/admin/guest-table";
import { RollupChips } from "@/components/admin/rollup-chips";
import { CapacityBar } from "@/components/admin/capacity-bar";

export default function AdminGuestsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl">Guest list</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track who&apos;s coming, who hasn&apos;t replied, and update RSVPs on
          behalf of guests who responded by phone.
        </p>
      </div>
      <RollupChips />
      <CapacityBar />
      <GuestTable />
    </div>
  );
}
```

- [ ] **Step 2: Replace `src/app/(admin)/admin/page.tsx` with a placeholder**

```tsx
import Link from "next/link";

export default function AdminLandingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl">Welcome</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Admin landing coming next. In the meantime, jump straight to the{" "}
          <Link href="/admin/guests" className="underline">
            guest list
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + lint**

```bash
pnpm typecheck && pnpm lint
```

- [ ] **Step 4: Commit**

```bash
git add 'src/app/(admin)/admin/guests/page.tsx' 'src/app/(admin)/admin/page.tsx'
git commit -m "feat(admin-landing): move guest list to /admin/guests, stub landing"
```

---

## Task T4 — Update internal `/admin` links

**Files:** seven (see table below).

Per the spec migration table, change six of the eight existing `/admin` references to `/admin/guests`. Two stay (`layout.tsx` logo + public `page.tsx` footer + `invitations-view.tsx`).

- [ ] **Step 1: `src/components/admin/admin-nav.tsx` — the "Guests" tab in BOTH the desktop and drawer blocks should point to `/admin/guests`**

In the desktop block, change:

```tsx
        <Link href="/admin" className={DESKTOP_LINK}>
          Guests
        </Link>
```

to:

```tsx
        <Link href="/admin/guests" className={DESKTOP_LINK}>
          Guests
        </Link>
```

In the drawer block, change:

```tsx
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="py-3 border-b border-border text-foreground"
              >
                Guests
              </Link>
```

to:

```tsx
              <Link
                href="/admin/guests"
                onClick={() => setOpen(false)}
                className="py-3 border-b border-border text-foreground"
              >
                Guests
              </Link>
```

- [ ] **Step 2: `src/app/(admin)/admin/import/page.tsx:117` — back-link to guest list**

Find the existing `href="/admin"` near line 117. The surrounding text is the "back" link from import. Change `href="/admin"` to `href="/admin/guests"`. If the link label says "back to admin" change it to "back to guest list"; if it already says "back to guest list" leave the label.

- [ ] **Step 3: `src/app/(admin)/admin/settings/page.tsx:193` — back-link**

Same surgical change: `href="/admin"` → `href="/admin/guests"`. Update label to match "back to guest list" if it currently says "back to admin".

- [ ] **Step 4: `src/app/(admin)/admin/guests/[id]/page.tsx:33` and `:45`**

Both `href="/admin"` references on this page are back-links to the guest list. Change both to `href="/admin/guests"`.

- [ ] **Step 5: `src/app/(admin)/admin/guests/new/page.tsx:20`**

Same: `href="/admin"` → `href="/admin/guests"`.

- [ ] **Step 6: Leave `src/app/(admin)/admin/layout.tsx:27` unchanged** (logo links to admin home, which IS `/admin`).

- [ ] **Step 7: Leave `src/app/page.tsx:74` unchanged** (public footer's "Admin" link should still land on the admin home).

- [ ] **Step 8: Leave `src/components/admin/invitations-view.tsx:44` unchanged** (the invitations print-view back-link is fine landing on the admin home).

- [ ] **Step 9: Typecheck + lint**

```bash
pnpm typecheck && pnpm lint
```

- [ ] **Step 10: Commit**

```bash
git add src/components/admin/admin-nav.tsx 'src/app/(admin)/admin/import/page.tsx' 'src/app/(admin)/admin/settings/page.tsx' 'src/app/(admin)/admin/guests/[id]/page.tsx' 'src/app/(admin)/admin/guests/new/page.tsx'
git commit -m "feat(admin-landing): update internal /admin → /admin/guests links"
```

---

## Task T5 — `CountdownHero` component

**Files:**
- Create: `src/components/admin/landing/countdown-hero.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { useQuery } from "convex/react";
import { api } from "@/lib/convex";

/**
 * Hero countdown to the wedding date. Reads `weddingDate` from public
 * settings (string `YYYY-MM-DD`). Renders fallbacks for unset / past dates.
 *
 * Day diff is computed against local midnight to avoid the "you arrive at
 * 11:59 PM and the number is one off" issue.
 */
export function CountdownHero() {
  const settings = useQuery(api.settings.publicSettings);

  if (settings === undefined) {
    // Render the same gradient frame to avoid layout shift on hydrate.
    return <Frame days="—" label="Loading…" date="" />;
  }

  const weddingDate =
    typeof settings["weddingDate"] === "string"
      ? (settings["weddingDate"] as string)
      : null;

  if (!weddingDate) {
    return (
      <Frame
        days="—"
        label="Wedding date not set"
        date="Pick one in Settings → Dates."
      />
    );
  }

  const target = startOfLocalDay(new Date(`${weddingDate}T00:00:00`));
  const today = startOfLocalDay(new Date());
  const diffDays = Math.round(
    (target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
  );

  if (diffDays === 0) {
    return (
      <Frame
        days="0"
        label="Today's the day!"
        date={formatDate(target)}
      />
    );
  }
  if (diffDays < 0) {
    return (
      <Frame
        days={String(Math.abs(diffDays))}
        label="Days since the big day"
        date={formatDate(target)}
      />
    );
  }
  return (
    <Frame
      days={String(diffDays)}
      label="Days until"
      date={formatDate(target)}
    />
  );
}

function Frame({
  days,
  label,
  date,
}: {
  days: string;
  label: string;
  date: string;
}) {
  return (
    <section className="rounded-xl bg-gradient-to-br from-blush/60 to-blush/30 border border-blush p-6 sm:p-10 text-center">
      <div className="font-heading text-5xl sm:text-7xl leading-none text-charcoal tabular-nums">
        {days}
      </div>
      <div className="mt-2 text-[10px] sm:text-xs uppercase tracking-[0.18em] text-charcoal/70">
        {label}
      </div>
      {date && (
        <div className="mt-2 text-xs sm:text-sm italic text-charcoal/70">
          {date}
        </div>
      )}
    </section>
  );
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
```

- [ ] **Step 2: Typecheck + lint**

```bash
pnpm typecheck && pnpm lint
```

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/landing/countdown-hero.tsx
git commit -m "feat(admin-landing): countdown hero component"
```

---

## Task T6 — `QuickActions` component

**Files:**
- Create: `src/components/admin/landing/quick-actions.tsx`

The "+ Appointment" action opens `GlobalAppointmentDialog`, which is built in T8. For this task, the button toggles a piece of local state and (until T8 wires the dialog) renders nothing visible — that lets us ship T6 without depending on T8.

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { UserPlus, CalendarPlus, Store, Gift } from "lucide-react";
import { GlobalAppointmentDialog } from "../global-appointment-dialog";

export function QuickActions() {
  const [appointmentOpen, setAppointmentOpen] = useState(false);

  return (
    <section className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
      <ActionLink href="/admin/guests/new" icon={<UserPlus className="size-5" />}>
        + Guest
      </ActionLink>
      <button
        type="button"
        onClick={() => setAppointmentOpen(true)}
        className="bg-card border border-border rounded-lg p-3 sm:p-4 min-h-[64px] flex flex-col items-center justify-center gap-1.5 text-xs uppercase tracking-widest hover:bg-muted transition"
      >
        <CalendarPlus className="size-5" />
        + Appt
      </button>
      <ActionLink href="/admin/vendors/new" icon={<Store className="size-5" />}>
        + Vendor
      </ActionLink>
      <ActionLink
        href="/admin/products/new"
        icon={<Gift className="size-5" />}
      >
        + Pick
      </ActionLink>

      <GlobalAppointmentDialog
        open={appointmentOpen}
        onOpenChange={setAppointmentOpen}
      />
    </section>
  );
}

function ActionLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="bg-card border border-border rounded-lg p-3 sm:p-4 min-h-[64px] flex flex-col items-center justify-center gap-1.5 text-xs uppercase tracking-widest hover:bg-muted transition"
    >
      {icon}
      {children}
    </Link>
  );
}
```

- [ ] **Step 2: Verify this won't typecheck yet (forward dep on T8)**

```bash
pnpm typecheck
```
Expected: FAIL with `Cannot find module '../global-appointment-dialog'` or similar. This is expected — the dialog is built in T8. Continue to step 3.

- [ ] **Step 3: Temporarily stub the dialog import to unblock**

Replace the import and the dialog usage in `quick-actions.tsx` with a stub for now. Change:

```tsx
import { GlobalAppointmentDialog } from "../global-appointment-dialog";
```

to:

```tsx
// Wired in T8 — temporary stub so this task ships independently.
function GlobalAppointmentDialog(_props: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  return null;
}
```

(Delete the old `import` line.)

- [ ] **Step 4: Typecheck + lint**

```bash
pnpm typecheck && pnpm lint
```
Both must pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/landing/quick-actions.tsx
git commit -m "feat(admin-landing): quick actions row (appointment stubbed for T8)"
```

---

## Task T7 — `GuestsCard`, `MoneyCard`, `DueSoonList`

**Files:**
- Create: `src/components/admin/landing/guests-card.tsx`
- Create: `src/components/admin/landing/money-card.tsx`
- Create: `src/components/admin/landing/due-soon-list.tsx`

All three are thin wrappers over existing components/data — they add headings, links, and (for Money) a "Due soon" list.

- [ ] **Step 1: Create `guests-card.tsx`**

```tsx
"use client";

import Link from "next/link";
import { RollupChips } from "../rollup-chips";
import { CapacityBar } from "../capacity-bar";

export function GuestsCard() {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-heading text-xl">Guests</h2>
        <Link
          href="/admin/guests"
          className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          View →
        </Link>
      </div>
      <RollupChips />
      <CapacityBar />
    </section>
  );
}
```

- [ ] **Step 2: Create `due-soon-list.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/lib/convex";
import { formatUSD } from "@/lib/utils";

const DAY_MS = 24 * 60 * 60 * 1000;

export function DueSoonList({ limit = 5 }: { limit?: number }) {
  const rollups = useQuery(api.vendors.rollups);

  if (rollups === undefined) return null;
  const upcoming = rollups.upcoming30d.slice(0, limit);
  if (upcoming.length === 0) return null;

  const now = Date.now();

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
        Due soon
      </h3>
      <ul className="divide-y divide-border">
        {upcoming.map((u) => {
          const days = Math.max(0, Math.round((u.dueAt - now) / DAY_MS));
          return (
            <li key={u.id} className="py-2 flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <Link
                  href={`/admin/vendors/${u.id}`}
                  className="text-sm font-medium hover:underline truncate block"
                >
                  {u.name}
                </Link>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Final · {days} day{days === 1 ? "" : "s"}
                </div>
              </div>
              <div className="text-sm font-medium tabular-nums">
                {formatUSD(u.amount)}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: Create `money-card.tsx`**

```tsx
"use client";

import Link from "next/link";
import { BudgetBar } from "../budget-bar";
import { DueSoonList } from "./due-soon-list";

export function MoneyCard() {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-heading text-xl">Money</h2>
        <Link
          href="/admin/vendors"
          className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          Vendors →
        </Link>
      </div>
      <BudgetBar />
      <DueSoonList />
    </section>
  );
}
```

- [ ] **Step 4: Typecheck + lint**

```bash
pnpm typecheck && pnpm lint
```

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/landing/guests-card.tsx src/components/admin/landing/money-card.tsx src/components/admin/landing/due-soon-list.tsx
git commit -m "feat(admin-landing): guests + money cards with due-soon list"
```

---

## Task T8 — Refactor `appointment-form.tsx` to export `AppointmentFormBody`; build `GlobalAppointmentDialog`

**Files:**
- Modify: `src/components/admin/appointment-form.tsx`
- Create: `src/components/admin/global-appointment-dialog.tsx`
- Modify: `src/components/admin/landing/quick-actions.tsx` (remove the stub from T6)

This is the load-bearing refactor: the inner `Body` component currently used by `AppointmentFormDialog` gets renamed and exported as `AppointmentFormBody` so `GlobalAppointmentDialog` can reuse it after the vendor is picked.

- [ ] **Step 1: In `src/components/admin/appointment-form.tsx`, rename the inner `Body` function to `AppointmentFormBody` and export it**

Two changes in that file:

a) Find:
```ts
function Body({
  vendorId,
  appointment,
  onDone,
}: {
```

Change to:
```ts
export function AppointmentFormBody({
  vendorId,
  appointment,
  onDone,
}: {
```

b) Find the call site (still inside `AppointmentFormDialog`):
```tsx
        <Body
          key={appointment?._id ?? "new"}
          vendorId={vendorId}
          appointment={appointment}
          onDone={() => onOpenChange(false)}
        />
```

Change `<Body` to `<AppointmentFormBody`:
```tsx
        <AppointmentFormBody
          key={appointment?._id ?? "new"}
          vendorId={vendorId}
          appointment={appointment}
          onDone={() => onOpenChange(false)}
        />
```

(No other behavior changes.)

- [ ] **Step 2: Create `src/components/admin/global-appointment-dialog.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/lib/convex";
import { type Id } from "../../../convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AppointmentFormBody } from "./appointment-form";

/**
 * Global "+ Appointment" entry point for the admin landing.
 *
 * Two states: pick a vendor, then render the existing appointment form
 * body against that vendor. The shared form body knows how to save and
 * close — we just give it a vendorId and an onDone handler.
 */
export function GlobalAppointmentDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && <Body onDone={() => onOpenChange(false)} />}
    </Dialog>
  );
}

function Body({ onDone }: { onDone: () => void }) {
  const vendors = useQuery(api.vendors.list, {});
  const [vendorId, setVendorId] = useState<Id<"vendors"> | null>(null);
  const [vendorName, setVendorName] = useState<string>("");
  const [search, setSearch] = useState("");

  if (vendorId === null) {
    const filtered = (vendors ?? []).filter((v) =>
      v.name.toLowerCase().includes(search.trim().toLowerCase()),
    );
    return (
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New appointment</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Which vendor is this with?
          </p>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vendors…"
            autoFocus
          />
          {vendors === undefined ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No vendors match.{" "}
              <a href="/admin/vendors/new" className="underline">
                Add one
              </a>
              .
            </p>
          ) : (
            <ul className="max-h-72 overflow-auto divide-y divide-border rounded-md border border-border">
              {filtered.map((v) => (
                <li key={v._id}>
                  <button
                    type="button"
                    onClick={() => {
                      setVendorId(v._id);
                      setVendorName(v.name);
                    }}
                    className="w-full text-left px-3 py-3 hover:bg-muted text-sm"
                  >
                    <div className="font-medium">{v.name}</div>
                    {v.category && (
                      <div className="text-xs text-muted-foreground">
                        {v.category}
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex justify-end">
            <Button variant="secondary" onClick={onDone}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    );
  }

  return (
    <>
      <div className="px-6 pt-4 -mb-2">
        <button
          type="button"
          onClick={() => {
            setVendorId(null);
            setVendorName("");
          }}
          className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          ← Change vendor
        </button>
        <p className="text-sm font-medium mt-1">{vendorName}</p>
      </div>
      <AppointmentFormBody
        key={vendorId}
        vendorId={vendorId}
        onDone={() => {
          toast.success(`Appointment saved on ${vendorName}`);
          onDone();
        }}
      />
    </>
  );
}
```

- [ ] **Step 3: Update `src/components/admin/landing/quick-actions.tsx` — remove the T6 stub and use the real import**

In `quick-actions.tsx`, delete this stub:

```tsx
// Wired in T8 — temporary stub so this task ships independently.
function GlobalAppointmentDialog(_props: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  return null;
}
```

And add this import near the top of the file (alongside the other imports):

```tsx
import { GlobalAppointmentDialog } from "../global-appointment-dialog";
```

- [ ] **Step 4: Typecheck + lint**

```bash
pnpm typecheck && pnpm lint
```
Both must pass. The `AppointmentFormDialog` (per-vendor variant on the vendor detail page) should still work unchanged — Step 1 only renamed the inner function and exported it.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/appointment-form.tsx src/components/admin/global-appointment-dialog.tsx src/components/admin/landing/quick-actions.tsx
git commit -m "feat(admin-landing): GlobalAppointmentDialog + export form body"
```

---

## Task T9 — `UpcomingAppointmentsCard`

**Files:**
- Create: `src/components/admin/landing/upcoming-appointments-card.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/lib/convex";
import { buildGoogleCalendarUrl } from "@/lib/google-calendar";

function formatDay(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function UpcomingAppointmentsCard() {
  const rows = useQuery(api.vendorAppointments.listUpcomingAll, { limit: 5 });

  return (
    <section className="space-y-3">
      <h2 className="font-heading text-xl">Upcoming appointments</h2>
      <div className="rounded-lg border border-border bg-card p-4">
        {rows === undefined ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No upcoming appointments. Schedule one from any vendor&apos;s page
            or use{" "}
            <span className="font-medium">+ Appt</span> above.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => {
              const url = buildGoogleCalendarUrl({
                title: `${r.vendorName} meeting`,
                startAt: r.startAt,
                endAt: r.endAt,
                location: r.location,
                notes: r.notes,
              });
              return (
                <li
                  key={r._id}
                  className="py-3 grid grid-cols-[80px_1fr_auto] gap-3 items-center"
                >
                  <div className="text-xs">
                    <div className="font-medium">{formatDay(r.startAt)}</div>
                    <div className="text-muted-foreground">
                      {formatTime(r.startAt)}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <Link
                      href={`/admin/vendors/${r.vendorId}`}
                      className="text-sm font-medium hover:underline block truncate"
                    >
                      {r.vendorName}
                    </Link>
                    {r.location && (
                      <div className="text-xs text-muted-foreground italic truncate">
                        {r.location}
                      </div>
                    )}
                  </div>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener"
                    className="text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-full border border-border bg-muted/40 hover:bg-muted whitespace-nowrap"
                  >
                    📅 Cal
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

```bash
pnpm typecheck && pnpm lint
```

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/landing/upcoming-appointments-card.tsx
git commit -m "feat(admin-landing): upcoming appointments card"
```

---

## Task T10 — Compose the final landing page

**Files:**
- Modify: `src/app/(admin)/admin/page.tsx`

- [ ] **Step 1: Replace the T3 placeholder with the real composition**

Overwrite the file with:

```tsx
import { CountdownHero } from "@/components/admin/landing/countdown-hero";
import { QuickActions } from "@/components/admin/landing/quick-actions";
import { GuestsCard } from "@/components/admin/landing/guests-card";
import { MoneyCard } from "@/components/admin/landing/money-card";
import { UpcomingAppointmentsCard } from "@/components/admin/landing/upcoming-appointments-card";

export default function AdminLandingPage() {
  return (
    <div className="space-y-6 sm:space-y-8">
      <CountdownHero />
      <QuickActions />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
        <GuestsCard />
        <MoneyCard />
      </div>
      <UpcomingAppointmentsCard />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

```bash
pnpm typecheck && pnpm lint
```

- [ ] **Step 3: Commit**

```bash
git add 'src/app/(admin)/admin/page.tsx'
git commit -m "feat(admin-landing): compose final landing page"
```

---

## Task T11 — Build + headed-browser smoke

- [ ] **Step 1: Final verification**

```bash
pnpm typecheck && pnpm lint && pnpm build:next
```
All three pass. Build output must list `/admin` and `/admin/guests` as separate routes.

- [ ] **Step 2: Headed-browser smoke (mobile + desktop)**

Drive a headed Playwright session per project memory `feedback_playwright_headed`.

**Mobile (390×844):**
1. Sign in to admin. Confirm landing page renders with countdown card, 2×2 quick actions, then stacked Guests / Money / Upcoming appointments.
2. Tap "+ Guest" — confirm navigation to `/admin/guests/new`.
3. Tap browser back, tap "Guests" in the nav — confirm navigation to `/admin/guests` (the moved guest list).
4. Tap browser back, tap "+ Appt" — confirm `GlobalAppointmentDialog` opens with the vendor picker. Type a vendor name; pick one; confirm the appointment form body renders with the chosen vendor's name above it. Tap "← Change vendor" — confirm you can pick a different vendor without the dialog closing. Pick again, fill in date/time, save — confirm toast says "Appointment saved on <vendor>".
5. Navigate to the vendor whose appointment you just saved — confirm the appointment shows in their per-vendor Upcoming list.
6. Back on `/admin`, confirm the new appointment now appears in the Upcoming appointments card.
7. Tap the "📅 Cal" button on a row — confirm Google Calendar opens prefilled in a new tab.
8. Confirm "Due soon" list renders if any vendor has a `finalDueAt` within 30 days (set one manually via the vendor's edit page if none exists).

**Desktop (1280×800):**
9. Resize to desktop. Confirm:
   - Countdown is wider, number scales up.
   - Quick actions are a single row of 4.
   - Guests and Money sit side-by-side in a 2-column grid.
   - Upcoming appointments is full-width below.
10. Confirm no horizontal scroll at either width.

- [ ] **Step 3: No commit needed** (verification only).

---

## Self-review summary

**Spec coverage:**

| Spec topic | Task |
|---|---|
| `by_start_status` index | T1 |
| `listUpcomingAll` cross-vendor query | T2 |
| Move guest list to `/admin/guests` | T3 |
| Update 6 internal `/admin` links per migration table | T4 |
| Countdown hero (handles unset / past / today / future) | T5 |
| Quick actions (4 buttons, 2×2 mobile / 4-up desktop) | T6 |
| Guests card wraps RollupChips + CapacityBar | T7 |
| Money card wraps BudgetBar + DueSoonList | T7 |
| DueSoonList reads `rollups.upcoming30d`, limit 5 | T7 |
| `GlobalAppointmentDialog` (vendor picker → form body) | T8 |
| Export `AppointmentFormBody` for reuse | T8 |
| Upcoming appointments card (link vendor name, Google Cal button) | T9 |
| Final landing composition (order, mobile stack, desktop 2-up) | T10 |
| Headed-browser smoke (mobile + desktop, both flows) | T11 |
| Public-side / public footer links — stay unchanged | T4 steps 6, 7, 8 |

**Placeholder scan:** no TBDs, no TODOs. T6 explicitly carries a stub function that T8 removes — this is sequenced, not abandoned.

**Type consistency:**
- `AppointmentFormBody` props `(vendorId, appointment?, onDone)` — match between T8 export site and T8 caller in `GlobalAppointmentDialog`.
- `GlobalAppointmentDialog` props `(open, onOpenChange)` — match between T6 stub, T8 real component, and T6→T8 consumer in `quick-actions.tsx`.
- `listUpcomingAll` return shape `{ ..._id, vendorId, vendorName, startAt, endAt, location?, notes? }` — match between T2 query and T9 consumer.
- `rollups.upcoming30d` shape `{ id, name, dueAt, amount }` — already exists in `convex/vendors.ts` (verified from the existing implementation); T7 `DueSoonList` consumes it directly.
- `buildGoogleCalendarUrl` (from `src/lib/google-calendar.ts`, shipped in vendor-appointments phase) — used in T9 with the same signature it already has.

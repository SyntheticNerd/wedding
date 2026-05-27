# Vendor Appointments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a per-vendor "Appointments" timeline on the vendor detail page, with "Add to Google Calendar" templated URLs and a mobile-first card layout.

**Architecture:** One new Convex table (`vendorAppointments`) with a single per-vendor index. A pure URL-builder helper for Google Calendar's `render?action=TEMPLATE` endpoint (no OAuth, no API). Three new client components — card, form (Dialog), and a section orchestrator — mounted on the existing `VendorDetail`. Mobile-first: stacked cards, native OS pickers for date/time, ≥40px touch targets, no horizontal scroll at 360px.

**Tech Stack:** Next.js 16 App Router (TypeScript strict), Convex 1.37, Clerk, shadcn/ui + Tailwind. No new dependencies.

**Reference docs:**
- Spec: `docs/superpowers/specs/2026-05-27-vendor-appointments-design.md`
- Convex usage rules: `convex/_generated/ai/guidelines.md`
- Existing patterns to copy:
  - `convex/vendors.ts` — module shape (queries, mutations, soft-delete)
  - `src/components/admin/vendor-form.tsx` — date input → epoch ms pattern (line ~75–80, ~118)
  - `src/components/admin/registry-form.tsx` — `Dialog`-based add/edit form
  - `src/components/admin/vendor-detail.tsx` — existing vendor detail layout

**Verification cadence:** project has no automated tests; verification is `pnpm typecheck && pnpm lint` per task, plus a headed-browser smoke at T8 (per project memory `feedback_playwright_headed`).

---

## File map

**Create:**
- `convex/vendorAppointments.ts` — list/get/add/update/setStatus/softDelete
- `src/lib/google-calendar.ts` — `buildGoogleCalendarUrl` pure helper
- `src/components/admin/appointment-card.tsx` — one card (display + Google Cal anchor + status chip toggle + edit/delete)
- `src/components/admin/appointment-form.tsx` — `AppointmentFormDialog` (add/edit)
- `src/components/admin/appointments-section.tsx` — orchestrator (upcoming + past, empty state, add button)

**Modify:**
- `convex/schema.ts` — add `vendorAppointments` table
- `src/components/admin/vendor-detail.tsx` — mount `<AppointmentsSection vendorId={...} vendorName={...} />`

---

## Task T1 — Schema: `vendorAppointments`

**Files:**
- Modify: `convex/schema.ts`

- [ ] **Step 1: Add the table inside `defineSchema({ ... })`**

In `convex/schema.ts`, insert immediately before the closing `});` of `defineSchema` (after the `registryProducts` block):

```ts
  vendorAppointments: defineTable({
    vendorId: v.id("vendors"),
    startAt: v.number(),
    endAt: v.number(),
    location: v.optional(v.string()),
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
  }).index("by_vendor", ["vendorId", "deletedAt", "startAt"]),
```

- [ ] **Step 2: Run convex codegen + typecheck**

```bash
npx convex codegen --typecheck disable
pnpm typecheck
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add convex/schema.ts convex/_generated/
git commit -m "feat(appointments): add vendorAppointments table"
```

---

## Task T2 — Convex queries + mutations

**Files:**
- Create: `convex/vendorAppointments.ts`

- [ ] **Step 1: Create the file with exact contents**

```ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { type Doc, type Id } from "./_generated/dataModel";
import { requireAdmin } from "./lib/auth";

const STATUS = v.union(
  v.literal("scheduled"),
  v.literal("completed"),
  v.literal("cancelled"),
);

/* ----------------------------------------------------------------------
   Queries
   -------------------------------------------------------------------- */

/** All non-deleted appointments for a vendor, ascending by startAt. */
export const listByVendor = query({
  args: { vendorId: v.id("vendors") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const vendorId = args.vendorId;
    const rows = await ctx.db
      .query("vendorAppointments")
      .withIndex("by_vendor", (q) =>
        q.eq("vendorId", vendorId).eq("deletedAt", undefined),
      )
      .collect();
    return rows.sort((a, b) => a.startAt - b.startAt);
  },
});

export const get = query({
  args: { id: v.id("vendorAppointments") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db.get(args.id);
  },
});

/* ----------------------------------------------------------------------
   Mutations
   -------------------------------------------------------------------- */

const appointmentFields = {
  vendorId: v.id("vendors"),
  startAt: v.number(),
  endAt: v.number(),
  location: v.optional(v.string()),
  notes: v.optional(v.string()),
  status: v.optional(STATUS),
};

export const add = mutation({
  args: appointmentFields,
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);
    if (args.endAt < args.startAt) {
      throw new Error("End time must be at or after start time");
    }
    const now = Date.now();
    const id = await ctx.db.insert("vendorAppointments", {
      vendorId: args.vendorId,
      startAt: args.startAt,
      endAt: args.endAt,
      location: args.location?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
      status: args.status ?? "scheduled",
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
    });
    return { id };
  },
});

export const update = mutation({
  args: { id: v.id("vendorAppointments"), ...appointmentFields },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Appointment not found");
    if (args.endAt < args.startAt) {
      throw new Error("End time must be at or after start time");
    }
    await ctx.db.patch(args.id, {
      vendorId: args.vendorId,
      startAt: args.startAt,
      endAt: args.endAt,
      location: args.location?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
      status: args.status ?? existing.status,
      updatedAt: Date.now(),
    });
    return args.id;
  },
});

export const setStatus = mutation({
  args: { id: v.id("vendorAppointments"), status: STATUS },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Appointment not found");
    await ctx.db.patch(args.id, {
      status: args.status,
      updatedAt: Date.now(),
    });
  },
});

export const softDelete = mutation({
  args: { id: v.id("vendorAppointments") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Appointment not found");
    await ctx.db.patch(args.id, {
      deletedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export type Appointment = Doc<"vendorAppointments">;
export type AppointmentId = Id<"vendorAppointments">;
```

- [ ] **Step 2: Regen + typecheck**

```bash
npx convex codegen --typecheck disable
pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add convex/vendorAppointments.ts convex/_generated/
git commit -m "feat(appointments): convex queries + mutations"
```

---

## Task T3 — Google Calendar URL helper

**Files:**
- Create: `src/lib/google-calendar.ts`

- [ ] **Step 1: Create the file**

```ts
/**
 * Build a "create event" URL for Google Calendar's templated endpoint.
 *
 * No OAuth required. The user clicks the link, lands on the Google
 * Calendar create-event page pre-filled with title/dates/location/notes,
 * and clicks Save. Works because the user is already signed in to Google
 * in the same browser session.
 *
 * Reference: https://calendar.google.com/calendar/render?action=TEMPLATE
 *   - text:     event title
 *   - dates:    UTC range, formatted YYYYMMDDTHHmmssZ/YYYYMMDDTHHmmssZ
 *   - details:  free-text body
 *   - location: free-text location
 */
export type GoogleCalendarEvent = {
  title: string;
  startAt: number; // epoch ms
  endAt: number;   // epoch ms
  location?: string;
  notes?: string;
};

export function buildGoogleCalendarUrl(event: GoogleCalendarEvent): string {
  const params = new URLSearchParams();
  params.set("action", "TEMPLATE");
  params.set("text", event.title);
  params.set(
    "dates",
    `${toGoogleUtc(event.startAt)}/${toGoogleUtc(event.endAt)}`,
  );
  if (event.location && event.location.trim()) {
    params.set("location", event.location.trim());
  }
  if (event.notes && event.notes.trim()) {
    params.set("details", event.notes.trim());
  }
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Format epoch ms as Google Calendar's UTC string: YYYYMMDDTHHmmssZ. */
function toGoogleUtc(ms: number): string {
  // toISOString gives 2026-06-09T18:00:00.000Z; strip dashes/colons/millis.
  return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 3: Verify the URL shape by hand**

Open `node` (or any TS scratch) and run:

```bash
node -e "
const { buildGoogleCalendarUrl } = require('./src/lib/google-calendar.ts');
console.log(buildGoogleCalendarUrl({
  title: 'Riverside Estate meeting',
  startAt: new Date('2026-06-09T14:00:00Z').getTime(),
  endAt:   new Date('2026-06-09T15:00:00Z').getTime(),
  location: 'At venue',
  notes: 'Walk through ceremony spaces',
}));
"
```

(If the project's TS loader doesn't run from raw `.ts`, skip this — the smoke test in T8 verifies the URL via a real click.)

Expected URL contains `dates=20260609T140000Z%2F20260609T150000Z` (URL-encoded `/`). Open the URL in a browser to confirm Google's create-event page loads pre-filled.

- [ ] **Step 4: Commit**

```bash
git add src/lib/google-calendar.ts
git commit -m "feat(appointments): Google Calendar templated URL builder"
```

---

## Task T4 — `AppointmentCard` display component

**Files:**
- Create: `src/components/admin/appointment-card.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/convex";
import { type Doc } from "../../../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buildGoogleCalendarUrl } from "@/lib/google-calendar";

const STATUS_ORDER = ["scheduled", "completed", "cancelled"] as const;
type Status = (typeof STATUS_ORDER)[number];

const STATUS_LABEL: Record<Status, string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_CLASS: Record<Status, string> = {
  scheduled: "bg-sage text-cream",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-transparent text-muted-foreground border border-muted-foreground",
};

function nextStatus(current: Status): Status {
  const i = STATUS_ORDER.indexOf(current);
  return STATUS_ORDER[(i + 1) % STATUS_ORDER.length];
}

function formatDay(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTimeRange(startMs: number, endMs: number): string {
  const fmt: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
  const startLabel = new Date(startMs).toLocaleTimeString(undefined, fmt);
  const endLabel = new Date(endMs).toLocaleTimeString(undefined, fmt);
  return startLabel === endLabel
    ? startLabel
    : `${startLabel} – ${endLabel}`;
}

export function AppointmentCard({
  appointment,
  vendorName,
  onEdit,
  isPast,
}: {
  appointment: Doc<"vendorAppointments">;
  vendorName: string;
  onEdit: () => void;
  isPast: boolean;
}) {
  const setStatus = useMutation(api.vendorAppointments.setStatus);
  const softDelete = useMutation(api.vendorAppointments.softDelete);
  const [busy, setBusy] = useState(false);

  const status = appointment.status as Status;
  const showPastHint = isPast && status === "scheduled";

  const calendarUrl = buildGoogleCalendarUrl({
    title: `${vendorName} meeting`,
    startAt: appointment.startAt,
    endAt: appointment.endAt,
    location: appointment.location,
    notes: appointment.notes,
  });

  async function cycleStatus() {
    if (busy) return;
    setBusy(true);
    try {
      const next = nextStatus(status);
      await setStatus({ id: appointment._id, status: next });
      toast.success(`Marked as ${STATUS_LABEL[next].toLowerCase()}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete appointment on ${formatDay(appointment.startAt)}?`)) return;
    try {
      await softDelete({ id: appointment._id });
      toast.success("Deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <article
      className={`rounded-md border border-border bg-card p-4 space-y-2 ${
        isPast ? "opacity-75" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium text-sm leading-tight">
            {formatDay(appointment.startAt)}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {formatTimeRange(appointment.startAt, appointment.endAt)}
          </div>
        </div>
        <button
          type="button"
          onClick={cycleStatus}
          disabled={busy}
          aria-label={`Status: ${STATUS_LABEL[status]} (click to change)`}
          className="shrink-0"
        >
          <Badge
            className={`text-[10px] uppercase tracking-widest ${STATUS_CLASS[status]}`}
          >
            {STATUS_LABEL[status]}
          </Badge>
        </button>
      </div>

      {appointment.location && (
        <p className="text-xs italic text-muted-foreground">
          {appointment.location}
        </p>
      )}

      {appointment.notes && (
        <p className="text-sm leading-snug line-clamp-3">{appointment.notes}</p>
      )}

      {showPastHint && (
        <p className="text-xs italic text-muted-foreground">
          Past — mark done?
        </p>
      )}

      <div className="flex items-center gap-2 pt-1">
        <a
          href={calendarUrl}
          target="_blank"
          rel="noopener"
          className="flex-1 min-h-[40px] inline-flex items-center justify-center gap-1.5 text-xs px-3 rounded-full border border-border bg-muted/40 hover:bg-muted transition"
        >
          📅 Add to Google Cal
        </a>
        <Button
          variant="ghost"
          size="icon"
          onClick={onEdit}
          aria-label="Edit appointment"
          className="size-10 rounded-full border border-border"
        >
          <Pencil className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={remove}
          aria-label="Delete appointment"
          className="size-10 rounded-full border border-border"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </article>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

```bash
pnpm typecheck && pnpm lint
```
No NEW errors or warnings.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/appointment-card.tsx
git commit -m "feat(admin): appointment card with status toggle + cal export"
```

---

## Task T5 — `AppointmentFormDialog`

**Files:**
- Create: `src/components/admin/appointment-form.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/lib/convex";
import { type Doc, type Id } from "../../../convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Status = "scheduled" | "completed" | "cancelled";

type FormValues = {
  date: string;       // YYYY-MM-DD
  startTime: string;  // HH:mm
  endTime: string;    // HH:mm
  location: string;
  notes: string;
  status: Status;
};

const STATUS_LIST: Status[] = ["scheduled", "completed", "cancelled"];
const STATUS_LABEL: Record<Status, string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
};

function defaultEndFromStart(startTime: string): string {
  if (!/^\d{2}:\d{2}$/.test(startTime)) return "";
  const [h, m] = startTime.split(":").map(Number);
  const total = h * 60 + m + 60; // +1h
  const eh = Math.floor((total / 60) % 24);
  const em = total % 60;
  return `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
}

function tsFromDateTime(date: string, time: string): number | null {
  if (!date || !time) return null;
  const ms = new Date(`${date}T${time}`).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function AppointmentFormDialog({
  open,
  onOpenChange,
  vendorId,
  appointment,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorId: Id<"vendors">;
  /** When provided, the form is in edit mode. */
  appointment?: Doc<"vendorAppointments">;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Keying by appointment id (or "new") forces fresh useState on each
          dialog opening — sidesteps the react-hooks/set-state-in-effect
          rule that flagged the registry form in phase 3. */}
      {open && (
        <Body
          key={appointment?._id ?? "new"}
          vendorId={vendorId}
          appointment={appointment}
          onDone={() => onOpenChange(false)}
        />
      )}
    </Dialog>
  );
}

function Body({
  vendorId,
  appointment,
  onDone,
}: {
  vendorId: Id<"vendors">;
  appointment?: Doc<"vendorAppointments">;
  onDone: () => void;
}) {
  const add = useMutation(api.vendorAppointments.add);
  const update = useMutation(api.vendorAppointments.update);

  const initial: FormValues = appointment
    ? {
        date: toDateString(appointment.startAt),
        startTime: toTimeString(appointment.startAt),
        endTime: toTimeString(appointment.endAt),
        location: appointment.location ?? "",
        notes: appointment.notes ?? "",
        status: appointment.status as Status,
      }
    : {
        date: toDateString(Date.now()),
        startTime: "09:00",
        endTime: "10:00",
        location: "",
        notes: "",
        status: "scheduled",
      };

  const [values, setValues] = useState<FormValues>(initial);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!values.date) {
      toast.error("Pick a date");
      return;
    }
    if (!values.startTime) {
      toast.error("Pick a start time");
      return;
    }
    const startAt = tsFromDateTime(values.date, values.startTime);
    if (startAt === null) {
      toast.error("Invalid start date/time");
      return;
    }
    const endTime = values.endTime || defaultEndFromStart(values.startTime);
    const endAt = tsFromDateTime(values.date, endTime);
    if (endAt === null) {
      toast.error("Invalid end time");
      return;
    }
    if (endAt < startAt) {
      toast.error("End time must be after start");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        vendorId,
        startAt,
        endAt,
        location: values.location || undefined,
        notes: values.notes || undefined,
        status: values.status,
      };
      if (appointment) {
        await update({ id: appointment._id, ...payload });
        toast.success("Saved");
      } else {
        await add(payload);
        toast.success("Added");
      }
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>
          {appointment ? "Edit appointment" : "New appointment"}
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        <Field label="Date">
          <Input
            type="date"
            value={values.date}
            onChange={(e) => setValues((s) => ({ ...s, date: e.target.value }))}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Start">
            <Input
              type="time"
              value={values.startTime}
              onChange={(e) =>
                setValues((s) => ({ ...s, startTime: e.target.value }))
              }
            />
          </Field>
          <Field label="End">
            <Input
              type="time"
              value={values.endTime}
              onChange={(e) =>
                setValues((s) => ({ ...s, endTime: e.target.value }))
              }
              placeholder={defaultEndFromStart(values.startTime) || "10:00"}
            />
          </Field>
        </div>

        <Field label="Location">
          <Input
            value={values.location}
            onChange={(e) =>
              setValues((s) => ({ ...s, location: e.target.value }))
            }
            placeholder="At venue / Zoom / phone…"
          />
        </Field>

        <Field label="Notes">
          <Textarea
            value={values.notes}
            onChange={(e) => setValues((s) => ({ ...s, notes: e.target.value }))}
            placeholder="Agenda, links, anything you want…"
            rows={4}
          />
        </Field>

        <Field label="Status">
          <div className="flex gap-2">
            {STATUS_LIST.map((s) => {
              const active = values.status === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setValues((v) => ({ ...v, status: s }))}
                  className={`text-xs px-3 py-2 rounded-full border min-h-[40px] ${
                    active
                      ? "bg-foreground text-background border-foreground"
                      : "bg-transparent border-border hover:bg-muted"
                  }`}
                  aria-pressed={active}
                >
                  {STATUS_LABEL[s]}
                </button>
              );
            })}
          </div>
        </Field>
      </div>

      <DialogFooter>
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </DialogContent>
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

function toDateString(ms: number): string {
  const d = new Date(ms);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toTimeString(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
```

- [ ] **Step 2: Typecheck + lint**

```bash
pnpm typecheck && pnpm lint
```

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/appointment-form.tsx
git commit -m "feat(admin): appointment add/edit dialog"
```

---

## Task T6 — `AppointmentsSection` orchestrator

**Files:**
- Create: `src/components/admin/appointments-section.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { api } from "@/lib/convex";
import { type Doc, type Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { AppointmentCard } from "./appointment-card";
import { AppointmentFormDialog } from "./appointment-form";

export function AppointmentsSection({
  vendorId,
  vendorName,
}: {
  vendorId: Id<"vendors">;
  vendorName: string;
}) {
  const appointments = useQuery(api.vendorAppointments.listByVendor, {
    vendorId,
  });
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Doc<"vendorAppointments"> | null>(null);
  const [pastOpen, setPastOpen] = useState(false);

  const { upcoming, past } = useMemo(() => {
    if (!appointments) return { upcoming: [], past: [] };
    const now = Date.now();
    const upcomingArr: Doc<"vendorAppointments">[] = [];
    const pastArr: Doc<"vendorAppointments">[] = [];
    for (const a of appointments) {
      if (a.status === "scheduled" && a.startAt >= now) {
        upcomingArr.push(a);
      } else {
        pastArr.push(a);
      }
    }
    // Upcoming: soonest first (already sorted ascending by query).
    // Past: most recent first.
    pastArr.sort((a, b) => b.startAt - a.startAt);
    return { upcoming: upcomingArr, past: pastArr };
  }, [appointments]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-heading text-xl">Appointments</h2>
        <Button onClick={() => setCreating(true)} size="sm">
          + Add
        </Button>
      </div>

      {appointments === undefined ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : appointments.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No appointments yet. Schedule one to keep the history straight.
        </p>
      ) : (
        <div className="space-y-3">
          {upcoming.length === 0 && (
            <p className="text-xs text-muted-foreground italic">
              Nothing upcoming.
            </p>
          )}
          {upcoming.map((a) => (
            <AppointmentCard
              key={a._id}
              appointment={a}
              vendorName={vendorName}
              isPast={false}
              onEdit={() => setEditing(a)}
            />
          ))}

          {past.length > 0 && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setPastOpen((v) => !v)}
                className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-muted-foreground py-2"
              >
                {pastOpen ? (
                  <ChevronDown className="size-3" />
                ) : (
                  <ChevronRight className="size-3" />
                )}
                Past · Done ({past.length})
              </button>
              {pastOpen && (
                <div className="space-y-3 mt-2">
                  {past.map((a) => (
                    <AppointmentCard
                      key={a._id}
                      appointment={a}
                      vendorName={vendorName}
                      isPast={true}
                      onEdit={() => setEditing(a)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <AppointmentFormDialog
        open={creating}
        onOpenChange={setCreating}
        vendorId={vendorId}
      />
      <AppointmentFormDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        vendorId={vendorId}
        appointment={editing ?? undefined}
      />
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
git add src/components/admin/appointments-section.tsx
git commit -m "feat(admin): appointments section orchestrator (upcoming + past)"
```

---

## Task T7 — Mount on Vendor Detail

**Files:**
- Modify: `src/components/admin/vendor-detail.tsx`

- [ ] **Step 1: Add the import**

In `src/components/admin/vendor-detail.tsx`, add to the existing imports near the top:

```tsx
import { AppointmentsSection } from "./appointments-section";
```

- [ ] **Step 2: Mount the section near the bottom of the returned JSX**

The existing `VendorDetail` returns a `<div className="space-y-6 max-w-3xl">` containing the vendor header, several `<section>` blocks (overview, pricing, contacts, payments, notes, etc.), and the Edit/Delete buttons. Find the closing `</div>` of the outer wrapper, and insert the `<AppointmentsSection />` immediately above it (as the last section before the wrapper closes):

```tsx
      {/* …existing sections — leave unchanged… */}

      <AppointmentsSection
        vendorId={vendor._id}
        vendorName={vendor.name}
      />
    </div>
  );
}
```

(If the engineer wants to place it differently — e.g. between Pricing and Payments — that's fine; the spec only requires it be on the vendor detail page. Default to "as the last section.")

- [ ] **Step 3: Typecheck + lint**

```bash
pnpm typecheck && pnpm lint
```

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/vendor-detail.tsx
git commit -m "feat(admin): mount AppointmentsSection on vendor detail"
```

---

## Task T8 — Build + headed-browser smoke

- [ ] **Step 1: Final verification**

```bash
pnpm typecheck && pnpm lint && pnpm build:next
```
All three pass with no NEW errors. (The 4 pre-existing `convex/_generated/*` warnings are fine.) Build output should list `/admin/vendors/[id]` (unchanged route — the new section is rendered inside it).

- [ ] **Step 2: Headed-browser smoke at mobile width (per project memory `feedback_playwright_headed`)**

Drive a headed Playwright session sized at 390×844 (iPhone 14 dimensions). Steps:

1. Sign in to admin.
2. Navigate to `/admin/vendors`. Pick any existing vendor or create one ("Riverside Estate") and open its detail page.
3. Confirm the new "Appointments" section appears at the bottom of the page with "No appointments yet…" empty state and an `+ Add` button.
4. Click `+ Add`. Confirm the dialog opens centered on the small viewport.
5. Pick a date one week out. Set start to 14:00, leave end blank. Set location "At venue". Set notes "Walkthrough". Leave status as Scheduled. Save.
6. Confirm the card renders in the Upcoming band with: date label, time range "2:00 PM – 3:00 PM" (the default-fill happens on save), location, notes, status badge "Scheduled," and the full-width "Add to Google Cal" button + 40px edit + delete buttons.
7. Click the **status badge** — confirm it cycles to "Completed" with a toast.
8. Click it again — cycles to "Cancelled".
9. Click it again — cycles back to "Scheduled".
10. Add a second appointment, set the date to **yesterday**. Save. Confirm it shows in the Past · Done collapsible band with the "Past — mark done?" italic line.
11. Click the **Add to Google Cal** button on either card. Confirm a new tab opens to `calendar.google.com/calendar/render` with the title, date/time, location, and notes pre-filled.
12. Click the edit (pencil) icon on a card. Change the notes and Save. Confirm the card updates in place.
13. Click the delete (trash) icon. Confirm the confirm dialog and that the card disappears after confirming.
14. Resize the browser to desktop width (1280×800). Confirm the cards still render correctly (single column, wider) and the dialog is centered.

- [ ] **Step 3: No commit needed**

Verification only. Open a follow-up task per defect if any surfaces.

---

## Self-review summary

**Spec coverage:**

| Spec topic | Task |
|---|---|
| `vendorAppointments` table + `by_vendor` index | T1 |
| Status union (`scheduled` / `completed` / `cancelled`) | T1, T2, T4, T5 |
| Per-vendor list query, get, add, update, setStatus, softDelete | T2 |
| `endAt >= startAt` validation in mutations | T2 (`add`, `update`) |
| Google Calendar templated URL helper | T3 |
| Card display with date/time, location, notes, status badge | T4 |
| Status chip free-cycle toggle | T4 (`nextStatus`, `cycleStatus`) |
| "Past — mark done?" hint | T4 (`showPastHint`) |
| "Add to Google Cal" anchor opening in new tab | T4 |
| Edit + delete icon actions with ≥40px touch targets | T4 (`size-10` icon buttons) |
| Add/edit form with date+time+location+notes+status | T5 |
| Default end = start + 1h | T5 (`defaultEndFromStart`, applied at save) |
| Native OS pickers via `<input type="date">` and `<input type="time">` | T5 |
| Status pill chooser in form | T5 |
| Empty state on vendor detail | T6 |
| Upcoming + collapsible Past bands | T6 |
| Mounted on `/admin/vendors/[id]` | T7 |
| Mobile-first card layout (single column, ≥40px targets) | T4 (card markup), T5 (form chips), verified in T8 |
| Headed-browser smoke at mobile width | T8 |
| Cross-vendor rollup | Out of scope — confirmed deferred |
| OAuth / .ics / recurring / reminders | Out of scope — not built (correct) |

**Placeholder scan:** No TBDs, no TODOs, no "implement later" prose. The T7 "engineer may choose to place differently" line is a judgment latitude, not a placeholder — the default is explicit ("as the last section").

**Type consistency:**
- `Doc<"vendorAppointments">` used consistently across T4, T5, T6.
- `Id<"vendors">` passed from T6 → T5 and from T7 → T6 consistently.
- `Status` union string-literal type matches the schema's `v.union(...)` literals.
- `STATUS_ORDER`/`STATUS_LABEL`/`STATUS_CLASS` keys match the literals (`scheduled`, `completed`, `cancelled`).
- `buildGoogleCalendarUrl` signature `(event: GoogleCalendarEvent) => string` matches its only caller (T4's `calendarUrl = buildGoogleCalendarUrl({...})`).
- `AppointmentFormDialog` props `(open, onOpenChange, vendorId, appointment?)` match both call sites in T6 (create + edit).

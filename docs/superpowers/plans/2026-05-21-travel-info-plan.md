# Travel & Info Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a "Travel & info" section on the home page (hotels · getting here · practical info) that's fully admin-editable, with no new Convex tables.

**Architecture:** Three new settings keys (`travel.hotels`, `travel.gettingHere`, `travel.practical`) added to the existing `settings` table and exposed via `publicSettings`. Public side renders three sub-blocks between the hero and contact form, hiding itself if all are empty. Admin side gets a single `/admin/travel` page with a hotels editor (reuses `SortableList`) + two textareas + one Save button.

**Tech Stack:** Next.js 16 App Router (TypeScript strict), Convex, shadcn/ui + Tailwind, `@dnd-kit/sortable` (already installed for the registry). No new dependencies.

**Reference docs:**
- Spec: `docs/superpowers/specs/2026-05-21-travel-info-design.md`
- Patterns to copy: `/admin/settings` (multi-key save in one mutation batch), `/admin/registries` (drag-reorder), `convex/settings.ts` (kv pattern + `PUBLIC_KEYS`)
- Verification cadence: project does NOT use automated tests; verification is `pnpm typecheck && pnpm lint` plus headed-browser check at the end.

---

## File map

**Create:**
- `src/lib/travel.ts` — `Hotel` type, validators, defensive parser
- `src/components/public/hotel-card.tsx` — one hotel card with copy-to-clipboard code chip
- `src/components/public/travel-section.tsx` — top-level public section (3 blocks, hides itself if all empty)
- `src/components/admin/hotel-row.tsx` — one inline hotel editor row
- `src/components/admin/travel-editor.tsx` — the full admin editor (hotels list + 2 textareas + Save)
- `src/app/(admin)/admin/travel/page.tsx` — admin page wrapper

**Modify:**
- `convex/settings.ts` — extend `PUBLIC_KEYS` with the three travel keys
- `src/app/page.tsx` — mount `<TravelSection />` between the hero `<section>` and the contact-form `<section>`
- `src/components/admin/admin-nav.tsx` — add "Travel" link between "Picks" and "Settings" (desktop + drawer)

---

## Task T1 — Add `Hotel` type + defensive parser

**Files:**
- Create: `src/lib/travel.ts`

- [ ] **Step 1: Create `src/lib/travel.ts`**

```ts
/**
 * Shared type + defensive parser for the Travel & Info section.
 *
 * Hotels live as a JSON array under the settings key `travel.hotels`. The
 * value comes from `v.any()` on Convex's side, so we can't trust its shape
 * at runtime. `parseHotels` accepts unknown input and returns a clean
 * array — bad entries are silently dropped (they'd only render as junk).
 */

export type PriceTier = "$" | "$$" | "$$$";

export type Hotel = {
  name: string;
  bookingUrl?: string;
  distance?: string;
  priceTier?: PriceTier;
  code?: string;
  notes?: string;
  hidden?: boolean;
};

const PRICE_TIERS: ReadonlySet<PriceTier> = new Set(["$", "$$", "$$$"]);

export function parseHotels(raw: unknown): Hotel[] {
  if (!Array.isArray(raw)) return [];
  const out: Hotel[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    if (typeof o.name !== "string" || !o.name.trim()) continue;
    const hotel: Hotel = { name: o.name.trim() };
    if (typeof o.bookingUrl === "string" && o.bookingUrl.trim()) {
      hotel.bookingUrl = o.bookingUrl.trim();
    }
    if (typeof o.distance === "string" && o.distance.trim()) {
      hotel.distance = o.distance.trim();
    }
    if (typeof o.priceTier === "string" && PRICE_TIERS.has(o.priceTier as PriceTier)) {
      hotel.priceTier = o.priceTier as PriceTier;
    }
    if (typeof o.code === "string" && o.code.trim()) {
      hotel.code = o.code.trim();
    }
    if (typeof o.notes === "string" && o.notes.trim()) {
      hotel.notes = o.notes.trim();
    }
    if (o.hidden === true) hotel.hidden = true;
    out.push(hotel);
  }
  return out;
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/travel.ts
git commit -m "feat(travel): Hotel type + defensive parser"
```

---

## Task T2 — Expose travel keys publicly

**Files:**
- Modify: `convex/settings.ts`

- [ ] **Step 1: Extend `PUBLIC_KEYS`**

Open `convex/settings.ts`. The existing `PUBLIC_KEYS` set already has `honeymoonFund.*` entries from the registry phase. Append the three travel keys:

```ts
const PUBLIC_KEYS = new Set([
  "lockedAt",
  "weddingDate",
  "coupleNames",
  "venueName",
  "venueLocation",
  "honeymoonFund.headline",
  "honeymoonFund.blurb",
  "honeymoonFund.ctaUrl",
  "honeymoonFund.ctaLabel",
  "honeymoonFund.enabled",
  "travel.hotels",
  "travel.gettingHere",
  "travel.practical",
]);
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm typecheck
git add convex/settings.ts
git commit -m "feat(travel): expose travel.* settings publicly"
```

---

## Task T3 — Public hotel card

**Files:**
- Create: `src/components/public/hotel-card.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy, Check } from "lucide-react";
import { type Hotel } from "@/lib/travel";

export function HotelCard({ hotel }: { hotel: Hotel }) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    if (!hotel.code) return;
    try {
      await navigator.clipboard.writeText(hotel.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can fail in older browsers / insecure contexts.
      // Silent — guest can still read and type the code by hand.
    }
  }

  const nameNode = hotel.bookingUrl ? (
    <Link
      href={hotel.bookingUrl}
      target="_blank"
      rel="noopener"
      className="font-medium hover:underline"
    >
      {hotel.name}
    </Link>
  ) : (
    <span className="font-medium">{hotel.name}</span>
  );

  return (
    <div className="bg-card border border-border rounded-md p-5 space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">{nameNode}</div>
        {hotel.priceTier && (
          <span className="text-xs text-muted-foreground tabular-nums shrink-0">
            {hotel.priceTier}
          </span>
        )}
      </div>

      {hotel.distance && (
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          {hotel.distance}
        </p>
      )}

      {hotel.code && (
        <button
          type="button"
          onClick={copyCode}
          className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-muted hover:bg-muted/70 transition"
          aria-label={`Copy room-block code ${hotel.code}`}
        >
          {copied ? (
            <Check className="size-3" />
          ) : (
            <Copy className="size-3" />
          )}
          <span className="font-mono">{hotel.code}</span>
        </button>
      )}

      {hotel.notes && (
        <p className="text-sm italic text-muted-foreground">{hotel.notes}</p>
      )}

      {hotel.bookingUrl && (
        <Link
          href={hotel.bookingUrl}
          target="_blank"
          rel="noopener"
          className="inline-block text-xs tracking-widest uppercase border border-foreground rounded-full px-4 py-1.5 hover:bg-foreground hover:text-background transition"
        >
          Book →
        </Link>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm typecheck
git add src/components/public/hotel-card.tsx
git commit -m "feat(public): hotel card with copy-to-clipboard code"
```

---

## Task T4 — Public travel section

**Files:**
- Create: `src/components/public/travel-section.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/lib/convex";
import { parseHotels } from "@/lib/travel";
import { HotelCard } from "./hotel-card";

export function TravelSection() {
  const settings = useQuery(api.settings.publicSettings);

  const hotels = useMemo(() => {
    if (!settings) return [];
    const all = parseHotels(settings["travel.hotels"]);
    return all.filter((h) => !h.hidden);
  }, [settings]);

  if (settings === undefined) return null;

  const gettingHere =
    typeof settings["travel.gettingHere"] === "string"
      ? (settings["travel.gettingHere"] as string).trim()
      : "";
  const practical =
    typeof settings["travel.practical"] === "string"
      ? (settings["travel.practical"] as string).trim()
      : "";

  const hasAnything =
    hotels.length > 0 || gettingHere.length > 0 || practical.length > 0;
  if (!hasAnything) return null;

  return (
    <section className="px-6 py-16 sm:py-24 border-t border-blush/40">
      <div className="mx-auto max-w-4xl space-y-12">
        <div className="text-center space-y-2">
          <h2 className="font-heading text-4xl sm:text-5xl">Travel &amp; info</h2>
          <div className="mx-auto h-px w-12 bg-blush" />
        </div>

        {hotels.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-heading text-2xl text-center">
              Where to stay
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {hotels.map((h, i) => (
                <HotelCard key={`${h.name}-${i}`} hotel={h} />
              ))}
            </div>
          </div>
        )}

        {gettingHere && (
          <div className="space-y-3">
            <h3 className="font-heading text-2xl text-center">Getting here</h3>
            <p className="whitespace-pre-line text-sm sm:text-base max-w-prose mx-auto">
              {gettingHere}
            </p>
          </div>
        )}

        {practical && (
          <div className="space-y-3">
            <h3 className="font-heading text-2xl text-center">Good to know</h3>
            <p className="whitespace-pre-line text-sm sm:text-base max-w-prose mx-auto">
              {practical}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm typecheck
git add src/components/public/travel-section.tsx
git commit -m "feat(public): travel section orchestrator"
```

---

## Task T5 — Mount TravelSection on the home page

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add the import and the JSX**

In `src/app/page.tsx`, add to the imports near the top:

```tsx
import { TravelSection } from "@/components/public/travel-section";
```

Then insert `<TravelSection />` between the hero `<section>` (the one ending with the RSVP/Registry CTAs) and the contact-form `<section>`. The relevant area in the file becomes:

```tsx
      <section className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
        {/* hero — unchanged */}
      </section>

      <TravelSection />

      <section className="px-6 pb-16 sm:pb-24">
        <div className="mx-auto max-w-xl">
          <ContactForm />
        </div>
      </section>
```

(Keep the rest of the file unchanged.)

- [ ] **Step 2: Typecheck + lint**

```bash
pnpm typecheck && pnpm lint
```
Both should pass. The section renders nothing until admin populates content, so the page should look unchanged in production until T6+ ships.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(public): mount TravelSection on the home page"
```

---

## Task T6 — Admin: HotelRow editor

**Files:**
- Create: `src/components/admin/hotel-row.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { type PriceTier } from "@/lib/travel";
import { Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

/**
 * Local-only shape — adds the transient `_id` SortableList needs.
 * Persisted JSON drops `_id` (see travel-editor.tsx).
 */
export type HotelDraft = {
  _id: string;
  name: string;
  bookingUrl: string;
  distance: string;
  priceTier: PriceTier | "";
  code: string;
  notes: string;
  hidden: boolean;
};

const TIER_OPTIONS: PriceTier[] = ["$", "$$", "$$$"];

export function HotelRow({
  hotel,
  onChange,
  onDelete,
}: {
  hotel: HotelDraft;
  onChange: (next: HotelDraft) => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-3 px-3 py-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Name *">
          <Input
            value={hotel.name}
            onChange={(e) => onChange({ ...hotel, name: e.target.value })}
            placeholder="Marriott Riverside"
          />
        </Field>
        <Field label="Booking URL">
          <Input
            value={hotel.bookingUrl}
            onChange={(e) => onChange({ ...hotel, bookingUrl: e.target.value })}
            placeholder="https://..."
          />
        </Field>
        <Field label="Distance">
          <Input
            value={hotel.distance}
            onChange={(e) => onChange({ ...hotel, distance: e.target.value })}
            placeholder="0.5 mi from venue"
          />
        </Field>
        <Field label="Price tier">
          <div className="flex gap-1">
            {TIER_OPTIONS.map((t) => {
              const active = hotel.priceTier === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() =>
                    onChange({
                      ...hotel,
                      priceTier: active ? "" : t,
                    })
                  }
                  className={`text-xs px-3 py-1.5 rounded-md border tabular-nums ${
                    active
                      ? "bg-foreground text-background border-foreground"
                      : "bg-transparent border-border hover:bg-muted"
                  }`}
                  aria-pressed={active}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="Room-block code">
          <Input
            value={hotel.code}
            onChange={(e) => onChange({ ...hotel, code: e.target.value })}
            placeholder="SMITH-JONES-2026"
          />
        </Field>
        <Field label="Notes (one line)">
          <Input
            value={hotel.notes}
            onChange={(e) => onChange({ ...hotel, notes: e.target.value })}
            placeholder="Ask for the wedding block"
          />
        </Field>
      </div>

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={hotel.hidden}
            onCheckedChange={(v) =>
              onChange({ ...hotel, hidden: v === true })
            }
          />
          Hide from public page
        </label>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          aria-label="Delete hotel"
        >
          <Trash2 className="size-4" />
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

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm typecheck
git add src/components/admin/hotel-row.tsx
git commit -m "feat(admin): hotel row editor component"
```

---

## Task T7 — Admin: TravelEditor

**Files:**
- Create: `src/components/admin/travel-editor.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useState, useMemo, useTransition } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/lib/convex";
import { parseHotels, type Hotel } from "@/lib/travel";
import { SortableList } from "./sortable-list";
import { HotelRow, type HotelDraft } from "./hotel-row";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function TravelEditor() {
  const settings = useQuery(api.settings.all);
  const setSetting = useMutation(api.settings.set);
  const [pending, startTransition] = useTransition();

  // Initialize local form state from server settings on first load,
  // re-key the form when settings flips from undefined → defined.
  if (settings === undefined) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  return (
    <Body
      key="loaded"
      settings={settings}
      pending={pending}
      onSave={(next) => {
        startTransition(async () => {
          try {
            await Promise.all([
              setSetting({
                key: "travel.hotels",
                value: next.hotels.length > 0 ? next.hotels : null,
              }),
              setSetting({
                key: "travel.gettingHere",
                value: next.gettingHere.trim() || null,
              }),
              setSetting({
                key: "travel.practical",
                value: next.practical.trim() || null,
              }),
            ]);
            toast.success("Saved");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Save failed");
          }
        });
      }}
    />
  );
}

function Body({
  settings,
  pending,
  onSave,
}: {
  settings: Record<string, unknown>;
  pending: boolean;
  onSave: (next: {
    hotels: Hotel[];
    gettingHere: string;
    practical: string;
  }) => void;
}) {
  const initialDrafts = useMemo<HotelDraft[]>(
    () =>
      parseHotels(settings["travel.hotels"]).map((h) => ({
        _id: crypto.randomUUID(),
        name: h.name,
        bookingUrl: h.bookingUrl ?? "",
        distance: h.distance ?? "",
        priceTier: h.priceTier ?? "",
        code: h.code ?? "",
        notes: h.notes ?? "",
        hidden: h.hidden === true,
      })),
    [settings],
  );

  const [drafts, setDrafts] = useState<HotelDraft[]>(initialDrafts);
  const [gettingHere, setGettingHere] = useState<string>(
    typeof settings["travel.gettingHere"] === "string"
      ? (settings["travel.gettingHere"] as string)
      : "",
  );
  const [practical, setPractical] = useState<string>(
    typeof settings["travel.practical"] === "string"
      ? (settings["travel.practical"] as string)
      : "",
  );

  function addHotel() {
    setDrafts((arr) => [
      ...arr,
      {
        _id: crypto.randomUUID(),
        name: "",
        bookingUrl: "",
        distance: "",
        priceTier: "",
        code: "",
        notes: "",
        hidden: false,
      },
    ]);
  }

  function updateHotel(index: number, next: HotelDraft) {
    setDrafts((arr) => arr.map((d, i) => (i === index ? next : d)));
  }

  function deleteHotel(id: string) {
    setDrafts((arr) => arr.filter((d) => d._id !== id));
  }

  function handleReorder(orderedIds: string[]) {
    const byId = new Map(drafts.map((d) => [d._id, d]));
    const next: HotelDraft[] = [];
    for (const id of orderedIds) {
      const d = byId.get(id);
      if (d) next.push(d);
    }
    // Defensive: append anything that wasn't in orderedIds (shouldn't happen).
    for (const d of drafts) if (!orderedIds.includes(d._id)) next.push(d);
    setDrafts(next);
  }

  function save() {
    // Reject empty-name rows quietly — they wouldn't survive parseHotels anyway.
    const cleaned: Hotel[] = drafts
      .filter((d) => d.name.trim().length > 0)
      .map((d) => {
        const h: Hotel = { name: d.name.trim() };
        if (d.bookingUrl.trim()) h.bookingUrl = d.bookingUrl.trim();
        if (d.distance.trim()) h.distance = d.distance.trim();
        if (d.priceTier) h.priceTier = d.priceTier;
        if (d.code.trim()) h.code = d.code.trim();
        if (d.notes.trim()) h.notes = d.notes.trim();
        if (d.hidden) h.hidden = true;
        return h;
      });
    onSave({ hotels: cleaned, gettingHere, practical });
  }

  return (
    <div className="space-y-10 max-w-3xl">
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-xl">Where to stay</h2>
          <Button variant="secondary" size="sm" onClick={addHotel}>
            Add hotel
          </Button>
        </div>
        {drafts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hotels yet. Add one with the button above.
          </p>
        ) : (
          <div className="rounded-md border border-border bg-card">
            <SortableList
              items={drafts}
              onReorder={handleReorder}
              renderItem={(d) => {
                const index = drafts.findIndex((x) => x._id === d._id);
                return (
                  <HotelRow
                    hotel={d}
                    onChange={(next) => updateHotel(index, next)}
                    onDelete={() => deleteHotel(d._id)}
                  />
                );
              }}
            />
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl">Getting here</h2>
        <Label className="text-xs uppercase tracking-widest text-muted-foreground">
          Free-form text. Paragraph breaks are preserved on the public page.
        </Label>
        <Textarea
          value={gettingHere}
          onChange={(e) => setGettingHere(e.target.value)}
          placeholder="Nearest airport, driving directions, parking…"
          rows={6}
        />
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl">Good to know</h2>
        <Label className="text-xs uppercase tracking-widest text-muted-foreground">
          Dress code, weather, day-of schedule.
        </Label>
        <Textarea
          value={practical}
          onChange={(e) => setPractical(e.target.value)}
          placeholder="Dress code, weather, schedule…"
          rows={6}
        />
      </section>

      <div className="pt-4 border-t border-border">
        <Button onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
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
git add src/components/admin/travel-editor.tsx
git commit -m "feat(admin): travel editor (hotels + 2 text blocks + save)"
```

---

## Task T8 — Admin route + nav link

**Files:**
- Create: `src/app/(admin)/admin/travel/page.tsx`
- Modify: `src/components/admin/admin-nav.tsx`

- [ ] **Step 1: Create the page**

```tsx
import { TravelEditor } from "@/components/admin/travel-editor";

export default function TravelPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl">Travel &amp; info</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Hotels, how to get here, and practical info for out-of-town guests.
          Shown on the home page between the hero and the contact form.
        </p>
      </div>
      <TravelEditor />
    </div>
  );
}
```

- [ ] **Step 2: Add the "Travel" nav link to `src/components/admin/admin-nav.tsx`**

In the desktop block, insert between the existing **Picks** and **Settings** links:

```tsx
        <Link href="/admin/products" className={DESKTOP_LINK}>
          Picks
        </Link>
        <Link href="/admin/travel" className={DESKTOP_LINK}>
          Travel
        </Link>
        <Link href="/admin/settings" className={DESKTOP_LINK}>
          Settings
        </Link>
```

In the drawer block, the same insertion between Picks and Settings:

```tsx
              <Link
                href="/admin/products"
                onClick={() => setOpen(false)}
                className="py-3 border-b border-border text-foreground"
              >
                Picks
              </Link>
              <Link
                href="/admin/travel"
                onClick={() => setOpen(false)}
                className="py-3 border-b border-border text-foreground"
              >
                Travel
              </Link>
              <Link
                href="/admin/settings"
                onClick={() => setOpen(false)}
                className="py-3 text-foreground"
              >
                Settings
              </Link>
```

- [ ] **Step 3: Typecheck + lint**

```bash
pnpm typecheck && pnpm lint
```

- [ ] **Step 4: Commit**

```bash
git add 'src/app/(admin)/admin/travel/page.tsx' src/components/admin/admin-nav.tsx
git commit -m "feat(admin): /admin/travel page + nav link"
```

---

## Task T9 — Build + headed-browser smoke

- [ ] **Step 1: Final verification**

```bash
pnpm typecheck && pnpm lint && pnpm build:next
```
All three must complete without errors. (Pre-existing warnings on `convex/_generated/*` are expected and unchanged.)

- [ ] **Step 2: Headed-browser smoke (per project memory — no manual instructions to user, no headless)**

Drive a headed Playwright session. Steps:

1. Sign in to admin.
2. Navigate to `/admin/travel`.
3. Click "Add hotel". Fill in: name "The Test Inn", URL `https://example.com`, distance "1 mi from venue", price tier `$$`, code "TESTBLOCK", notes "ask for the test block". Save.
4. Add a second hotel ("Skip Inn") with `hidden: true`. Save.
5. Drag-reorder the two hotels (swap them). Save.
6. Type into Getting here: `Fly into XYZ.\n\nDrive 30 min south.` Save.
7. Type into Practical info: `Dress code: cocktail.` Save.
8. Open the home page (`/`). Confirm:
   - "Travel & info" section appears between the hero and the contact form.
   - Hotel grid shows one card (the hidden one is omitted). Order matches the admin's drag-reorder.
   - Clicking the code chip toasts "Copied!" and copies to clipboard (check via `navigator.clipboard.readText()` in dev tools if needed).
   - The "Book" button opens `https://example.com` in a new tab.
   - "Getting here" preserves the paragraph break.
   - "Good to know" renders the dress-code line.
9. Back in admin, delete both hotels and clear both textareas. Save.
10. Refresh `/`. Confirm the entire "Travel & info" section is now hidden (back to hero → contact form).

- [ ] **Step 3: No commit needed**

Verification only. If anything fails, open a follow-up task per defect.

---

## Self-review summary

**Spec coverage:**

| Spec topic | Task |
|---|---|
| Section position (between hero and contact form) | T5 |
| Section label "Travel & info" | T4, T5 |
| Hotels block — cards, fields, copy code, hide empty | T3, T4 |
| Getting here / Practical info — plain text with paragraph breaks | T4 |
| Hide whole section if all empty | T4 |
| Admin page `/admin/travel` with three areas + one Save | T7, T8 |
| Hotels admin: drag-reorder, hide, delete, add | T6, T7 |
| Admin nav "Travel" between Picks and Settings | T8 |
| `Hotel` type + defensive parser | T1 |
| 3 settings keys exposed via `publicSettings` (PUBLIC_KEYS) | T2 |
| Transient client-side `_id` for SortableList; stripped on save | T7 (HotelDraft + `cleaned` mapping in `save`) |
| Validation: drop bad entries | T1 (parser) + T7 (empty-name filter) |
| Out of scope (markdown, map embeds, structured schedule, etc.) | not built — correct |

No placeholders. Types and names consistent across tasks (`Hotel`, `HotelDraft`, `parseHotels`, `PriceTier`, `TravelSection`, `TravelEditor`, `HotelCard`, `HotelRow`).

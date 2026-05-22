# Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Registry page (Phase 3 of the wedding site): honeymoon-fund hero + registry hub strip + curated picks grid with filters/sort/pagination, plus admin surfaces to manage all of it.

**Architecture:** Two new Convex tables (`registries`, `registryProducts`) plus five settings keys for the fund. Admin uses the existing list+detail pattern (mirrors `/admin/vendors`). The public `/registry` page is a Convex-backed client component that paginates via Convex's native `paginate()` API. Product import is paste-URL → server-side OG/JSON-LD fetch (Convex Node action) → admin reviews and edits before save.

**Tech Stack:** Next.js 16 App Router (TypeScript strict), Convex 1.37, Clerk auth, shadcn/ui + Tailwind, `@dnd-kit/sortable` (new dep) for drag-reorder, `node-html-parser` (new dep) for OG parsing. Verification cadence is `pnpm typecheck && pnpm lint` plus headed Playwright browser checks — no automated tests are added (project norm; CLAUDE.md scopes TDD to data-model/validation, which this doesn't introduce).

**Reference docs:**
- Spec: `docs/superpowers/specs/2026-05-21-registry-design.md`
- Convex usage rules: `convex/_generated/ai/guidelines.md`
- Existing reference admin module: `convex/vendors.ts` + `src/app/(admin)/admin/vendors/*` + `src/components/admin/vendor-*.tsx`

---

## Phase 3a — Schema + registries CRUD

### Task A1: Extend Convex schema with `registries` and `registryProducts`

**Files:**
- Modify: `convex/schema.ts`

- [ ] **Step 1: Open the schema and locate the closing brace of `defineSchema({ ... })`**

Existing schema ends at the `vendors` table block. We insert two new tables before the closing `});`.

- [ ] **Step 2: Add the two new tables to `convex/schema.ts`**

Insert immediately before the closing `});` of `defineSchema`:

```ts
  registries: defineTable({
    name: v.string(),
    url: v.string(),
    logoUrl: v.optional(v.string()),
    blurb: v.optional(v.string()),
    displayOrder: v.number(),
    hidden: v.boolean(),
    createdAt: v.number(),
    createdBy: v.string(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  }).index("by_display_order", ["deletedAt", "hidden", "displayOrder"]),

  registryProducts: defineTable({
    registryId: v.id("registries"),
    name: v.string(),
    priceCents: v.number(),
    imageUrl: v.string(),
    productUrl: v.string(),
    displayOrder: v.number(),
    hidden: v.boolean(),
    // Claim
    claimedAt: v.optional(v.number()),
    claimedBy: v.optional(v.string()),
    // OG fetch trail
    ogFetchedAt: v.optional(v.number()),
    ogTitle: v.optional(v.string()),
    ogImageUrl: v.optional(v.string()),
    createdAt: v.number(),
    createdBy: v.string(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_registry", ["registryId", "deletedAt"])
    .index("by_display_order", ["deletedAt", "hidden", "displayOrder"])
    .index("by_price", ["deletedAt", "hidden", "priceCents"])
    .searchIndex("search_name", {
      searchField: "name",
      filterFields: ["registryId", "hidden", "deletedAt"],
    }),
```

- [ ] **Step 3: Run typecheck**

```bash
pnpm typecheck
```
Expected: PASS. If Convex codegen hasn't run, run `pnpm dev` once in another shell and let it generate, then re-typecheck.

- [ ] **Step 4: Commit**

```bash
git add convex/schema.ts
git commit -m "feat(registry): add registries + registryProducts tables"
```

---

### Task A2: Add Convex queries + mutations for `registries`

**Files:**
- Create: `convex/registries.ts`

- [ ] **Step 1: Create `convex/registries.ts`**

```ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { type Doc, type Id } from "./_generated/dataModel";
import { requireAdmin } from "./lib/auth";

/* ----------------------------------------------------------------------
   Queries
   -------------------------------------------------------------------- */

/** Admin list: every non-deleted registry, ordered by displayOrder. */
export const listAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("registries").collect();
    return rows
      .filter((r) => r.deletedAt === undefined)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  },
});

/** Public list: only non-deleted, non-hidden, ordered by displayOrder. */
export const listPublic = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("registries").collect();
    return rows
      .filter((r) => r.deletedAt === undefined && !r.hidden)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  },
});

export const get = query({
  args: { id: v.id("registries") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db.get(args.id);
  },
});

/* ----------------------------------------------------------------------
   Mutations
   -------------------------------------------------------------------- */

const registryFields = {
  name: v.string(),
  url: v.string(),
  logoUrl: v.optional(v.string()),
  blurb: v.optional(v.string()),
  hidden: v.optional(v.boolean()),
};

export const add = mutation({
  args: registryFields,
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);
    const now = Date.now();

    // Append to the end: max(displayOrder) + 10, leaving sparse gaps so
    // future drag-reorders rarely need a full renumber.
    const existing = await ctx.db.query("registries").collect();
    const maxOrder = existing.reduce(
      (m, r) => (r.displayOrder > m ? r.displayOrder : m),
      0,
    );

    const id = await ctx.db.insert("registries", {
      name: args.name.trim(),
      url: args.url.trim(),
      logoUrl: args.logoUrl?.trim() || undefined,
      blurb: args.blurb?.trim() || undefined,
      displayOrder: maxOrder + 10,
      hidden: args.hidden ?? false,
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
    });
    return { id };
  },
});

export const update = mutation({
  args: { id: v.id("registries"), ...registryFields },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Registry not found");
    await ctx.db.patch(args.id, {
      name: args.name.trim(),
      url: args.url.trim(),
      logoUrl: args.logoUrl?.trim() || undefined,
      blurb: args.blurb?.trim() || undefined,
      hidden: args.hidden ?? existing.hidden,
      updatedAt: Date.now(),
    });
    return args.id;
  },
});

export const setHidden = mutation({
  args: { id: v.id("registries"), hidden: v.boolean() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Registry not found");
    await ctx.db.patch(args.id, {
      hidden: args.hidden,
      updatedAt: Date.now(),
    });
  },
});

export const softDelete = mutation({
  args: { id: v.id("registries") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Registry not found");
    await ctx.db.patch(args.id, {
      deletedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const restore = mutation({
  args: { id: v.id("registries") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Registry not found");
    await ctx.db.patch(args.id, {
      deletedAt: undefined,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Reorder registries by passing the desired sequence of IDs.
 * Renumbers all rows to displayOrder = 10, 20, 30, ... in the given order.
 * IDs not included are pushed to the end in their previous relative order.
 */
export const reorder = mutation({
  args: { orderedIds: v.array(v.id("registries")) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const rows = (await ctx.db.query("registries").collect()).filter(
      (r) => r.deletedAt === undefined,
    );
    const byId = new Map<Id<"registries">, Doc<"registries">>(
      rows.map((r) => [r._id, r]),
    );
    const seen = new Set<Id<"registries">>();
    const ordered: Doc<"registries">[] = [];

    for (const id of args.orderedIds) {
      const row = byId.get(id);
      if (row) {
        ordered.push(row);
        seen.add(id);
      }
    }
    // Anything not in orderedIds keeps its prior relative order and goes last.
    const remainder = rows
      .filter((r) => !seen.has(r._id))
      .sort((a, b) => a.displayOrder - b.displayOrder);
    const final = [...ordered, ...remainder];

    const now = Date.now();
    for (let i = 0; i < final.length; i++) {
      const newOrder = (i + 1) * 10;
      if (final[i].displayOrder !== newOrder) {
        await ctx.db.patch(final[i]._id, {
          displayOrder: newOrder,
          updatedAt: now,
        });
      }
    }
  },
});

export type Registry = Doc<"registries">;
export type RegistryId = Id<"registries">;
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add convex/registries.ts
git commit -m "feat(registry): convex queries + mutations for registries"
```

---

### Task A3: Install `@dnd-kit` packages

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`

- [ ] **Step 1: Install**

```bash
pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```
Expected: three new deps in `package.json`.

- [ ] **Step 2: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add @dnd-kit for admin drag-reorder"
```

---

### Task A4: Build a reusable `SortableList` wrapper

**Files:**
- Create: `src/components/admin/sortable-list.tsx`

This is shared by Phase 3a (registries) and Phase 3b (products) — DRY.

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { type ReactNode } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

type Identifiable = { _id: string };

type SortableListProps<T extends Identifiable> = {
  items: T[];
  onReorder: (orderedIds: string[]) => void;
  renderItem: (item: T) => ReactNode;
};

export function SortableList<T extends Identifiable>({
  items,
  onReorder,
  renderItem,
}: SortableListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i._id === active.id);
    const newIndex = items.findIndex((i) => i._id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const next = items.slice();
    const [moved] = next.splice(oldIndex, 1);
    next.splice(newIndex, 0, moved);
    onReorder(next.map((i) => i._id));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map((i) => i._id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <SortableRow key={item._id} id={item._id}>
              {renderItem(item)}
            </SortableRow>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      className="flex items-center"
    >
      <button
        type="button"
        aria-label="Drag to reorder"
        className="px-2 py-3 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <div className="flex-1">{children}</div>
    </li>
  );
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/sortable-list.tsx
git commit -m "feat(admin): reusable drag-reorder list wrapper"
```

---

### Task A5: Build the registry form (dialog) + row + list

**Files:**
- Create: `src/components/admin/registry-form.tsx`
- Create: `src/components/admin/registry-row.tsx`
- Create: `src/components/admin/registry-list.tsx`

- [ ] **Step 1: Create `registry-form.tsx`**

```tsx
"use client";

import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/lib/convex";
import { type Id } from "../../../convex/_generated/dataModel";
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
import { Checkbox } from "@/components/ui/checkbox";

export type RegistryFormValues = {
  name: string;
  url: string;
  logoUrl: string;
  blurb: string;
  hidden: boolean;
};

const EMPTY: RegistryFormValues = {
  name: "",
  url: "",
  logoUrl: "",
  blurb: "",
  hidden: false,
};

export function RegistryFormDialog({
  open,
  onOpenChange,
  initial,
  registryId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: RegistryFormValues;
  registryId?: Id<"registries">;
}) {
  const [values, setValues] = useState<RegistryFormValues>(initial ?? EMPTY);
  const add = useMutation(api.registries.add);
  const update = useMutation(api.registries.update);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setValues(initial ?? EMPTY);
  }, [open, initial]);

  async function save() {
    if (!values.name.trim() || !values.url.trim()) {
      toast.error("Name and URL are required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: values.name,
        url: values.url,
        logoUrl: values.logoUrl || undefined,
        blurb: values.blurb || undefined,
        hidden: values.hidden,
      };
      if (registryId) {
        await update({ id: registryId, ...payload });
      } else {
        await add(payload);
      }
      toast.success(registryId ? "Saved" : "Added");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{registryId ? "Edit registry" : "Add registry"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Name *">
            <Input
              value={values.name}
              onChange={(e) =>
                setValues((v) => ({ ...v, name: e.target.value }))
              }
              placeholder="Crate & Barrel"
            />
          </Field>
          <Field label="URL *">
            <Input
              value={values.url}
              onChange={(e) =>
                setValues((v) => ({ ...v, url: e.target.value }))
              }
              placeholder="https://www.crateandbarrel.com/gift-registry/..."
            />
          </Field>
          <Field label="Logo URL">
            <Input
              value={values.logoUrl}
              onChange={(e) =>
                setValues((v) => ({ ...v, logoUrl: e.target.value }))
              }
              placeholder="https://.../logo.png"
            />
          </Field>
          <Field label="Blurb">
            <Input
              value={values.blurb}
              onChange={(e) =>
                setValues((v) => ({ ...v, blurb: e.target.value }))
              }
              placeholder="Optional one-liner"
            />
          </Field>
          <div className="flex items-center gap-2">
            <Checkbox
              id="reg-hidden"
              checked={values.hidden}
              onCheckedChange={(v) =>
                setValues((s) => ({ ...s, hidden: v === true }))
              }
            />
            <Label htmlFor="reg-hidden">Hide from the public page</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
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

- [ ] **Step 2: Create `registry-row.tsx`**

```tsx
"use client";

import Image from "next/image";
import { useMutation } from "convex/react";
import { Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/convex";
import { type Doc } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";

export function RegistryRow({
  registry,
  productCount,
  onEdit,
}: {
  registry: Doc<"registries">;
  productCount: number;
  onEdit: () => void;
}) {
  const setHidden = useMutation(api.registries.setHidden);
  const softDelete = useMutation(api.registries.softDelete);

  async function toggleHidden() {
    try {
      await setHidden({ id: registry._id, hidden: !registry.hidden });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  async function remove() {
    if (
      !confirm(
        productCount > 0
          ? `Delete "${registry.name}"? It has ${productCount} product(s). They will stop rendering publicly until the registry is restored or the products are reassigned.`
          : `Delete "${registry.name}"?`,
      )
    ) {
      return;
    }
    try {
      await softDelete({ id: registry._id });
      toast.success("Deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <div className="flex items-center gap-3 px-3 py-3">
      <div className="size-10 flex items-center justify-center bg-muted rounded">
        {registry.logoUrl ? (
          <Image
            src={registry.logoUrl}
            alt=""
            width={40}
            height={40}
            unoptimized
            className="object-contain w-full h-full"
          />
        ) : (
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            {registry.name.slice(0, 2)}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{registry.name}</div>
        <div className="text-xs text-muted-foreground truncate">
          {registry.url}
        </div>
      </div>
      <div className="text-xs text-muted-foreground tabular-nums">
        {productCount} item{productCount === 1 ? "" : "s"}
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleHidden}
        aria-label={registry.hidden ? "Unhide" : "Hide"}
      >
        {registry.hidden ? (
          <EyeOff className="size-4" />
        ) : (
          <Eye className="size-4" />
        )}
      </Button>
      <Button variant="ghost" size="sm" onClick={onEdit} aria-label="Edit">
        <Pencil className="size-4" />
      </Button>
      <Button variant="ghost" size="sm" onClick={remove} aria-label="Delete">
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: Create `registry-list.tsx`**

```tsx
"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/lib/convex";
import { Button } from "@/components/ui/button";
import { SortableList } from "./sortable-list";
import { RegistryRow } from "./registry-row";
import { RegistryFormDialog, type RegistryFormValues } from "./registry-form";
import { type Doc, type Id } from "../../../convex/_generated/dataModel";

export function RegistryList() {
  const registries = useQuery(api.registries.listAdmin);
  const productCounts = useQuery(api.registryProducts.countsByRegistry);
  const reorder = useMutation(api.registries.reorder);

  const [editing, setEditing] = useState<Doc<"registries"> | null>(null);
  const [creating, setCreating] = useState(false);

  const countsMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const { registryId, count } of productCounts ?? []) {
      m.set(registryId, count);
    }
    return m;
  }, [productCounts]);

  async function handleReorder(orderedIds: string[]) {
    try {
      await reorder({ orderedIds: orderedIds as Id<"registries">[] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reorder failed");
    }
  }

  if (registries === undefined) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>Add registry</Button>
      </div>

      {registries.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No registries yet. Add one to start curating picks.
        </p>
      ) : (
        <div className="rounded-md border border-border bg-card">
          <SortableList
            items={registries}
            onReorder={handleReorder}
            renderItem={(r) => (
              <RegistryRow
                registry={r}
                productCount={countsMap.get(r._id) ?? 0}
                onEdit={() => setEditing(r)}
              />
            )}
          />
        </div>
      )}

      <RegistryFormDialog open={creating} onOpenChange={setCreating} />

      <RegistryFormDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        registryId={editing?._id}
        initial={
          editing
            ? ({
                name: editing.name,
                url: editing.url,
                logoUrl: editing.logoUrl ?? "",
                blurb: editing.blurb ?? "",
                hidden: editing.hidden,
              } satisfies RegistryFormValues)
            : undefined
        }
      />
    </div>
  );
}
```

- [ ] **Step 4: Note about `countsByRegistry`**

The list depends on `api.registryProducts.countsByRegistry`, which doesn't exist yet — it's defined in Task B2. For Phase 3a we can ship without it temporarily; replace the `productCounts = useQuery(...)` line with `productCounts: { registryId: string; count: number }[] | undefined = []` for now. Task B2 swaps it back.

Apply this stub edit:

```tsx
  const productCounts: { registryId: string; count: number }[] | undefined = [];
```

(remove the `const productCounts = useQuery(...)` line)

- [ ] **Step 5: Run typecheck**

```bash
pnpm typecheck
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/registry-*.tsx
git commit -m "feat(admin): registry list, row, and form components"
```

---

### Task A6: Wire `/admin/registries` page + nav link

**Files:**
- Create: `src/app/(admin)/admin/registries/page.tsx`
- Modify: `src/components/admin/admin-nav.tsx`

- [ ] **Step 1: Create the page**

```tsx
import { RegistryList } from "@/components/admin/registry-list";

export default function RegistriesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl">Registries</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Where you&apos;re registered. Shown as a logo strip on the public
          Registry page.
        </p>
      </div>
      <RegistryList />
    </div>
  );
}
```

- [ ] **Step 2: Add the nav link (desktop and drawer)**

In `src/components/admin/admin-nav.tsx`, add a `Registry` link between `Vendors` and `Settings` in both the desktop nav and the mobile drawer. The desktop block:

```tsx
        <Link href="/admin/vendors" className={DESKTOP_LINK}>
          Vendors
        </Link>
        <Link href="/admin/registries" className={DESKTOP_LINK}>
          Registry
        </Link>
        <Link href="/admin/settings" className={DESKTOP_LINK}>
          Settings
        </Link>
```

And the matching drawer block:

```tsx
              <Link
                href="/admin/vendors"
                onClick={() => setOpen(false)}
                className="py-3 border-b border-border text-foreground"
              >
                Vendors
              </Link>
              <Link
                href="/admin/registries"
                onClick={() => setOpen(false)}
                className="py-3 border-b border-border text-foreground"
              >
                Registry
              </Link>
              <Link
                href="/admin/settings"
                onClick={() => setOpen(false)}
                className="py-3 text-foreground"
              >
                Settings
              </Link>
```

- [ ] **Step 3: Typecheck, lint, browser-verify**

```bash
pnpm typecheck && pnpm lint
```
Then `pnpm dev`, sign in, navigate to `/admin/registries`. Add a registry, edit it, hide/unhide it, drag-reorder if you have ≥2, delete it. Verify behavior in a headed Playwright session per project memory.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(admin\)/admin/registries/page.tsx src/components/admin/admin-nav.tsx
git commit -m "feat(admin): /admin/registries page + nav link"
```

---

## Phase 3b — Products admin (manual entry only)

### Task B1: Convex queries + mutations for `registryProducts` (no OG yet)

**Files:**
- Create: `convex/registryProducts.ts`

- [ ] **Step 1: Create `convex/registryProducts.ts`**

```ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { type Doc, type Id } from "./_generated/dataModel";
import { requireAdmin } from "./lib/auth";

/* ----------------------------------------------------------------------
   Queries (admin)
   -------------------------------------------------------------------- */

export const listAdmin = query({
  args: {
    registryId: v.optional(v.id("registries")),
    hidden: v.optional(v.boolean()),
    claimed: v.optional(v.boolean()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const search = args.search?.trim();

    let rows: Doc<"registryProducts">[];
    if (search) {
      rows = await ctx.db
        .query("registryProducts")
        .withSearchIndex("search_name", (q) => {
          let qb = q.search("name", search);
          if (args.registryId) qb = qb.eq("registryId", args.registryId);
          if (args.hidden !== undefined) qb = qb.eq("hidden", args.hidden);
          qb = qb.eq("deletedAt", undefined);
          return qb;
        })
        .collect();
    } else if (args.registryId) {
      const rid = args.registryId;
      rows = await ctx.db
        .query("registryProducts")
        .withIndex("by_registry", (q) =>
          q.eq("registryId", rid).eq("deletedAt", undefined),
        )
        .collect();
    } else {
      rows = await ctx.db.query("registryProducts").collect();
    }

    return rows
      .filter((p) => p.deletedAt === undefined)
      .filter((p) => (args.hidden === undefined ? true : p.hidden === args.hidden))
      .filter((p) => {
        if (args.claimed === undefined) return true;
        const isClaimed = p.claimedAt !== undefined;
        return isClaimed === args.claimed;
      })
      .sort((a, b) => a.displayOrder - b.displayOrder);
  },
});

export const countsByRegistry = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = (await ctx.db.query("registryProducts").collect()).filter(
      (p) => p.deletedAt === undefined,
    );
    const counts = new Map<string, number>();
    for (const r of rows) {
      counts.set(r.registryId, (counts.get(r.registryId) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([registryId, count]) => ({
      registryId,
      count,
    }));
  },
});

export const get = query({
  args: { id: v.id("registryProducts") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db.get(args.id);
  },
});

/* ----------------------------------------------------------------------
   Mutations
   -------------------------------------------------------------------- */

const productFields = {
  registryId: v.id("registries"),
  name: v.string(),
  priceCents: v.number(),
  imageUrl: v.string(),
  productUrl: v.string(),
  hidden: v.optional(v.boolean()),
};

export const add = mutation({
  args: {
    ...productFields,
    // Optional OG snapshot, written when called from the fetch flow.
    ogTitle: v.optional(v.string()),
    ogImageUrl: v.optional(v.string()),
    ogFetchedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);
    const now = Date.now();

    const existing = await ctx.db.query("registryProducts").collect();
    const maxOrder = existing.reduce(
      (m, r) => (r.displayOrder > m ? r.displayOrder : m),
      0,
    );

    const id = await ctx.db.insert("registryProducts", {
      registryId: args.registryId,
      name: args.name.trim(),
      priceCents: Math.max(0, Math.round(args.priceCents)),
      imageUrl: args.imageUrl.trim(),
      productUrl: args.productUrl.trim(),
      displayOrder: maxOrder + 10,
      hidden: args.hidden ?? false,
      ogTitle: args.ogTitle,
      ogImageUrl: args.ogImageUrl,
      ogFetchedAt: args.ogFetchedAt,
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
    });
    return { id };
  },
});

export const update = mutation({
  args: { id: v.id("registryProducts"), ...productFields },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Product not found");
    await ctx.db.patch(args.id, {
      registryId: args.registryId,
      name: args.name.trim(),
      priceCents: Math.max(0, Math.round(args.priceCents)),
      imageUrl: args.imageUrl.trim(),
      productUrl: args.productUrl.trim(),
      hidden: args.hidden ?? existing.hidden,
      updatedAt: Date.now(),
    });
    return args.id;
  },
});

export const setHidden = mutation({
  args: { id: v.id("registryProducts"), hidden: v.boolean() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Product not found");
    await ctx.db.patch(args.id, { hidden: args.hidden, updatedAt: Date.now() });
  },
});

export const setClaimed = mutation({
  args: { id: v.id("registryProducts"), claimed: v.boolean() },
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Product not found");
    await ctx.db.patch(args.id, {
      claimedAt: args.claimed ? Date.now() : undefined,
      claimedBy: args.claimed ? userId : undefined,
      updatedAt: Date.now(),
    });
  },
});

export const softDelete = mutation({
  args: { id: v.id("registryProducts") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Product not found");
    await ctx.db.patch(args.id, {
      deletedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const reorder = mutation({
  args: { orderedIds: v.array(v.id("registryProducts")) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const rows = (await ctx.db.query("registryProducts").collect()).filter(
      (p) => p.deletedAt === undefined,
    );
    const byId = new Map<Id<"registryProducts">, Doc<"registryProducts">>(
      rows.map((r) => [r._id, r]),
    );
    const seen = new Set<Id<"registryProducts">>();
    const ordered: Doc<"registryProducts">[] = [];

    for (const id of args.orderedIds) {
      const row = byId.get(id);
      if (row) {
        ordered.push(row);
        seen.add(id);
      }
    }
    const remainder = rows
      .filter((r) => !seen.has(r._id))
      .sort((a, b) => a.displayOrder - b.displayOrder);
    const final = [...ordered, ...remainder];

    const now = Date.now();
    for (let i = 0; i < final.length; i++) {
      const newOrder = (i + 1) * 10;
      if (final[i].displayOrder !== newOrder) {
        await ctx.db.patch(final[i]._id, {
          displayOrder: newOrder,
          updatedAt: now,
        });
      }
    }
  },
});

/**
 * Apply an OG snapshot returned by `fetchOg` to a product, but only
 * overwrite the snapshot fields (ogTitle, ogImageUrl, ogFetchedAt).
 * Admin's name / imageUrl / priceCents are untouched.
 */
export const applyOgSnapshot = mutation({
  args: {
    id: v.id("registryProducts"),
    ogTitle: v.optional(v.string()),
    ogImageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Product not found");
    await ctx.db.patch(args.id, {
      ogTitle: args.ogTitle,
      ogImageUrl: args.ogImageUrl,
      ogFetchedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export type RegistryProduct = Doc<"registryProducts">;
export type RegistryProductId = Id<"registryProducts">;
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add convex/registryProducts.ts
git commit -m "feat(registry): convex queries + mutations for products"
```

---

### Task B2: Unstub the counts query in `registry-list.tsx`

**Files:**
- Modify: `src/components/admin/registry-list.tsx`

- [ ] **Step 1: Restore the live counts query**

Replace the stub line:

```tsx
  const productCounts: { registryId: string; count: number }[] | undefined = [];
```

With:

```tsx
  const productCounts = useQuery(api.registryProducts.countsByRegistry);
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm typecheck
git add src/components/admin/registry-list.tsx
git commit -m "feat(admin): wire live product counts in registry list"
```

---

### Task B3: Build product form (page, not dialog — too many fields)

**Files:**
- Create: `src/components/admin/product-form.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/lib/convex";
import { type Doc, type Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type ProductFormValues = {
  registryId: string;
  name: string;
  priceDollars: string;
  imageUrl: string;
  productUrl: string;
  hidden: boolean;
};

export const EMPTY_PRODUCT: ProductFormValues = {
  registryId: "",
  name: "",
  priceDollars: "",
  imageUrl: "",
  productUrl: "",
  hidden: false,
};

export function ProductForm({
  initial,
  product,
  ogSnapshot,
}: {
  initial: ProductFormValues;
  product?: Doc<"registryProducts">;
  /** Set when this is a freshly-fetched draft. Saved on first add. */
  ogSnapshot?: { ogTitle?: string; ogImageUrl?: string };
}) {
  const router = useRouter();
  const registries = useQuery(api.registries.listAdmin);
  const add = useMutation(api.registryProducts.add);
  const update = useMutation(api.registryProducts.update);
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);

  function validate(): string | null {
    if (!values.registryId) return "Pick a registry";
    if (!values.name.trim()) return "Name is required";
    const cents = parsePriceToCents(values.priceDollars);
    if (cents === null) return "Price must be a non-negative number";
    if (!values.imageUrl.trim()) return "Image URL is required";
    if (!values.productUrl.trim()) return "Product URL is required";
    return null;
  }

  async function save() {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setSaving(true);
    try {
      const cents = parsePriceToCents(values.priceDollars)!;
      if (product) {
        await update({
          id: product._id,
          registryId: values.registryId as Id<"registries">,
          name: values.name,
          priceCents: cents,
          imageUrl: values.imageUrl,
          productUrl: values.productUrl,
          hidden: values.hidden,
        });
        toast.success("Saved");
      } else {
        const { id } = await add({
          registryId: values.registryId as Id<"registries">,
          name: values.name,
          priceCents: cents,
          imageUrl: values.imageUrl,
          productUrl: values.productUrl,
          hidden: values.hidden,
          ogTitle: ogSnapshot?.ogTitle,
          ogImageUrl: ogSnapshot?.ogImageUrl,
          ogFetchedAt: ogSnapshot ? Date.now() : undefined,
        });
        toast.success("Added");
        router.push(`/admin/products/${id}`);
        return;
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-4">
        <div>
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">
            Preview
          </Label>
          <div className="mt-2 aspect-square bg-muted rounded flex items-center justify-center overflow-hidden">
            {values.imageUrl ? (
              <Image
                src={values.imageUrl}
                alt=""
                width={140}
                height={140}
                unoptimized
                className="object-cover w-full h-full"
              />
            ) : (
              <span className="text-xs text-muted-foreground">no image</span>
            )}
          </div>
        </div>
        <div className="space-y-4">
          <Field label="Registry *">
            <Select
              value={values.registryId}
              onValueChange={(v) =>
                setValues((s) => ({ ...s, registryId: v }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Pick a registry…" />
              </SelectTrigger>
              <SelectContent>
                {(registries ?? []).map((r) => (
                  <SelectItem key={r._id} value={r._id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Name *">
            <Input
              value={values.name}
              onChange={(e) =>
                setValues((s) => ({ ...s, name: e.target.value }))
              }
              placeholder="Le Creuset 7qt Dutch Oven"
            />
          </Field>
          <Field label="Price (USD) *">
            <Input
              value={values.priceDollars}
              onChange={(e) =>
                setValues((s) => ({ ...s, priceDollars: e.target.value }))
              }
              placeholder="380"
              inputMode="decimal"
            />
          </Field>
          <Field label="Image URL *">
            <Input
              value={values.imageUrl}
              onChange={(e) =>
                setValues((s) => ({ ...s, imageUrl: e.target.value }))
              }
              placeholder="https://..."
            />
          </Field>
          <Field label="Product URL *">
            <Input
              value={values.productUrl}
              onChange={(e) =>
                setValues((s) => ({ ...s, productUrl: e.target.value }))
              }
              placeholder="https://..."
            />
          </Field>
          <div className="flex items-center gap-2">
            <Checkbox
              id="prod-hidden"
              checked={values.hidden}
              onCheckedChange={(v) =>
                setValues((s) => ({ ...s, hidden: v === true }))
              }
            />
            <Label htmlFor="prod-hidden">Hide from the public grid</Label>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : product ? "Save changes" : "Add product"}
        </Button>
        <Button variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs uppercase tracking-widest text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

/** Parse user-typed dollars into integer cents. Returns null on bad input. */
export function parsePriceToCents(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm typecheck
git add src/components/admin/product-form.tsx
git commit -m "feat(admin): registry product form"
```

---

### Task B4: Build product list + row

**Files:**
- Create: `src/components/admin/product-row.tsx`
- Create: `src/components/admin/product-list.tsx`

- [ ] **Step 1: Create `product-row.tsx`**

```tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { useMutation } from "convex/react";
import { Eye, EyeOff, Pencil, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/convex";
import { type Doc } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function ProductRow({
  product,
  registryName,
}: {
  product: Doc<"registryProducts">;
  registryName: string;
}) {
  const setHidden = useMutation(api.registryProducts.setHidden);
  const setClaimed = useMutation(api.registryProducts.setClaimed);
  const softDelete = useMutation(api.registryProducts.softDelete);

  async function toggleHidden() {
    try {
      await setHidden({ id: product._id, hidden: !product.hidden });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }
  async function toggleClaimed() {
    try {
      await setClaimed({
        id: product._id,
        claimed: product.claimedAt === undefined,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }
  async function remove() {
    if (!confirm(`Delete "${product.name}"?`)) return;
    try {
      await softDelete({ id: product._id });
      toast.success("Deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="flex items-center gap-3 px-3 py-3">
      <div className="size-12 flex items-center justify-center bg-muted rounded overflow-hidden">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt=""
            width={48}
            height={48}
            unoptimized
            className="object-cover w-full h-full"
          />
        ) : null}
      </div>
      <div className="flex-1 min-w-0">
        <Link
          href={`/admin/products/${product._id}`}
          className="font-medium truncate hover:underline block"
        >
          {product.name}
        </Link>
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <span>${(product.priceCents / 100).toFixed(2)}</span>
          <span>·</span>
          <span>{registryName}</span>
          {product.claimedAt !== undefined && (
            <Badge variant="secondary" className="ml-1">
              Claimed
            </Badge>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleClaimed}
        aria-label={
          product.claimedAt !== undefined
            ? "Mark as not claimed"
            : "Mark as claimed"
        }
      >
        {product.claimedAt !== undefined ? (
          <X className="size-4" />
        ) : (
          <Check className="size-4" />
        )}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleHidden}
        aria-label={product.hidden ? "Unhide" : "Hide"}
      >
        {product.hidden ? (
          <EyeOff className="size-4" />
        ) : (
          <Eye className="size-4" />
        )}
      </Button>
      <Link
        href={`/admin/products/${product._id}`}
        aria-label="Edit"
        className="inline-flex items-center justify-center size-9 rounded-md hover:bg-muted"
      >
        <Pencil className="size-4" />
      </Link>
      <Button variant="ghost" size="sm" onClick={remove} aria-label="Delete">
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Create `product-list.tsx`**

```tsx
"use client";

import { useState, useDeferredValue, useMemo } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/lib/convex";
import { type Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SortableList } from "./sortable-list";
import { ProductRow } from "./product-row";

export function ProductList() {
  const [search, setSearch] = useState("");
  const [registryFilter, setRegistryFilter] = useState<string>("all");
  const [hiddenFilter, setHiddenFilter] = useState<string>("all"); // all|visible|hidden
  const [claimedFilter, setClaimedFilter] = useState<string>("all"); // all|claimed|open

  const deferredSearch = useDeferredValue(search);
  const registries = useQuery(api.registries.listAdmin);
  const products = useQuery(api.registryProducts.listAdmin, {
    search: deferredSearch || undefined,
    registryId:
      registryFilter !== "all" ? (registryFilter as Id<"registries">) : undefined,
    hidden:
      hiddenFilter === "all"
        ? undefined
        : hiddenFilter === "hidden",
    claimed:
      claimedFilter === "all"
        ? undefined
        : claimedFilter === "claimed",
  });
  const reorder = useMutation(api.registryProducts.reorder);

  const registryMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of registries ?? []) m.set(r._id, r.name);
    return m;
  }, [registries]);

  async function handleReorder(orderedIds: string[]) {
    try {
      await reorder({ orderedIds: orderedIds as Id<"registryProducts">[] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reorder failed");
    }
  }

  const reorderable =
    !search.trim() && registryFilter === "all" && hiddenFilter === "all" && claimedFilter === "all";

  if (products === undefined) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          <Input
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <FilterSelect
            value={registryFilter}
            onChange={setRegistryFilter}
            label="Registry"
            options={[
              { value: "all", label: "All registries" },
              ...((registries ?? []).map((r) => ({ value: r._id, label: r.name }))),
            ]}
          />
          <FilterSelect
            value={hiddenFilter}
            onChange={setHiddenFilter}
            label="Visibility"
            options={[
              { value: "all", label: "All" },
              { value: "visible", label: "Visible" },
              { value: "hidden", label: "Hidden" },
            ]}
          />
          <FilterSelect
            value={claimedFilter}
            onChange={setClaimedFilter}
            label="Claim"
            options={[
              { value: "all", label: "All" },
              { value: "open", label: "Available" },
              { value: "claimed", label: "Claimed" },
            ]}
          />
        </div>
        <Link
          href="/admin/products/new"
          className="inline-flex items-center px-3 py-2 rounded-md bg-foreground text-background text-sm"
        >
          Add product
        </Link>
      </div>

      {!reorderable && (
        <p className="text-xs text-muted-foreground">
          Reorder is disabled while filters/search are active.
        </p>
      )}

      {products.length === 0 ? (
        <p className="text-sm text-muted-foreground">No products match.</p>
      ) : (
        <div className="rounded-md border border-border bg-card">
          {reorderable ? (
            <SortableList
              items={products}
              onReorder={handleReorder}
              renderItem={(p) => (
                <ProductRow
                  product={p}
                  registryName={registryMap.get(p.registryId) ?? "—"}
                />
              )}
            />
          ) : (
            <ul className="divide-y divide-border">
              {products.map((p) => (
                <li key={p._id} className="px-4">
                  <ProductRow
                    product={p}
                    registryName={registryMap.get(p.registryId) ?? "—"}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  label,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-auto" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

- [ ] **Step 3: Typecheck + commit**

```bash
pnpm typecheck
git add src/components/admin/product-row.tsx src/components/admin/product-list.tsx
git commit -m "feat(admin): registry product list + row"
```

---

### Task B5: Wire `/admin/products` (list, new, detail) routes

**Files:**
- Create: `src/app/(admin)/admin/products/page.tsx`
- Create: `src/app/(admin)/admin/products/new/page.tsx`
- Create: `src/app/(admin)/admin/products/[id]/page.tsx`

For Phase 3b the **new** flow is manual entry only. The fetch button is added in Phase 3c.

- [ ] **Step 1: List page**

`src/app/(admin)/admin/products/page.tsx`:

```tsx
import { ProductList } from "@/components/admin/product-list";

export default function ProductsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl">Curated picks</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Hand-picked items pulled from the registries above. Shown on the
          public Registry page.
        </p>
      </div>
      <ProductList />
    </div>
  );
}
```

- [ ] **Step 2: New page**

`src/app/(admin)/admin/products/new/page.tsx`:

```tsx
"use client";

import { ProductForm, EMPTY_PRODUCT } from "@/components/admin/product-form";

export default function NewProductPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="font-heading text-3xl">Add product</h1>
      <ProductForm initial={EMPTY_PRODUCT} />
    </div>
  );
}
```

- [ ] **Step 3: Detail page**

`src/app/(admin)/admin/products/[id]/page.tsx`:

```tsx
"use client";

import { use } from "react";
import { useQuery } from "convex/react";
import { api } from "@/lib/convex";
import { ProductForm } from "@/components/admin/product-form";
import { type Id } from "../../../../../../convex/_generated/dataModel";

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const productId = id as Id<"registryProducts">;
  const product = useQuery(api.registryProducts.get, { id: productId });

  if (product === undefined) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (product === null) {
    return <p className="text-sm text-muted-foreground">Not found.</p>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="font-heading text-3xl">Edit product</h1>
      <ProductForm
        product={product}
        initial={{
          registryId: product.registryId,
          name: product.name,
          priceDollars: (product.priceCents / 100).toString(),
          imageUrl: product.imageUrl,
          productUrl: product.productUrl,
          hidden: product.hidden,
        }}
      />
    </div>
  );
}
```

- [ ] **Step 4: Add nav link**

In `src/components/admin/admin-nav.tsx`, add a `Picks` link to both the desktop and drawer nav, right after `Registry`:

```tsx
        <Link href="/admin/registries" className={DESKTOP_LINK}>
          Registry
        </Link>
        <Link href="/admin/products" className={DESKTOP_LINK}>
          Picks
        </Link>
```

And in the drawer:

```tsx
              <Link
                href="/admin/registries"
                onClick={() => setOpen(false)}
                className="py-3 border-b border-border text-foreground"
              >
                Registry
              </Link>
              <Link
                href="/admin/products"
                onClick={() => setOpen(false)}
                className="py-3 border-b border-border text-foreground"
              >
                Picks
              </Link>
```

- [ ] **Step 5: Typecheck, lint, browser-verify**

```bash
pnpm typecheck && pnpm lint
```

In a headed browser: add a registry, then add a product manually (paste an image URL from any retailer, type a name + price + product URL), edit it, toggle hidden, toggle claimed, delete. Drag-reorder when ≥2 products exist.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(admin\)/admin/products src/components/admin/admin-nav.tsx
git commit -m "feat(admin): /admin/products list, new, detail + nav link"
```

---

## Phase 3c — OG fetcher + paste-URL flow + refetch

### Task C1: Install `node-html-parser`

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`

- [ ] **Step 1: Install**

```bash
pnpm add node-html-parser
```

- [ ] **Step 2: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add node-html-parser for OG fetch action"
```

---

### Task C2: Create `convex/productFetch.ts` — pure parser + action wrapper

**Files:**
- Create: `convex/productFetch.ts`

Split into a pure `parseProductMetadata(html, baseUrl)` function (easy to verify by passing real saved HTML) and the `fetchOg` action that does the network call and calls the parser.

- [ ] **Step 1: Create the file**

```ts
"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { requireAdmin } from "./lib/auth";
import { parse, type HTMLElement } from "node-html-parser";

const TIMEOUT_MS = 8000;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

export type FetchOgResult =
  | {
      ok: true;
      fields: {
        title?: string;
        imageUrl?: string;
        priceCents?: number;
      };
      ogTitle?: string;
      ogImageUrl?: string;
    }
  | { ok: false; reason: "network" | "blocked" | "metadata_missing" };

export const fetchOg = action({
  args: { url: v.string() },
  handler: async (ctx, args): Promise<FetchOgResult> => {
    await requireAdmin(ctx);

    let response: Response;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        response = await fetch(args.url, {
          headers: { "User-Agent": UA, Accept: "text/html,*/*;q=0.8" },
          signal: controller.signal,
          redirect: "follow",
        });
      } finally {
        clearTimeout(timer);
      }
    } catch {
      return { ok: false, reason: "network" };
    }

    if (response.status === 403 || response.status === 503) {
      return { ok: false, reason: "blocked" };
    }
    if (!response.ok) {
      return { ok: false, reason: "network" };
    }

    const html = await response.text();
    const parsed = parseProductMetadata(html, args.url);
    if (
      parsed.title === undefined &&
      parsed.imageUrl === undefined &&
      parsed.priceCents === undefined
    ) {
      return { ok: false, reason: "metadata_missing" };
    }
    return {
      ok: true,
      fields: parsed,
      ogTitle: parsed.title,
      ogImageUrl: parsed.imageUrl,
    };
  },
});

/* ----------------------------------------------------------------------
   Pure parser (exported for verification)
   -------------------------------------------------------------------- */

export function parseProductMetadata(
  html: string,
  baseUrl: string,
): { title?: string; imageUrl?: string; priceCents?: number } {
  const root = parse(html);

  const fromJsonLd = readJsonLdProduct(root);
  const fromOg = readOpenGraph(root);
  const fromMicrodata = readMicrodata(root);

  const title =
    fromJsonLd.title ?? fromOg.title ?? fromMicrodata.title;
  const imageUrlRaw =
    fromJsonLd.imageUrl ?? fromOg.imageUrl ?? fromMicrodata.imageUrl;
  const priceCents =
    fromJsonLd.priceCents ?? fromOg.priceCents ?? fromMicrodata.priceCents;

  const imageUrl = imageUrlRaw ? toAbsoluteUrl(imageUrlRaw, baseUrl) : undefined;

  return { title, imageUrl, priceCents };
}

type Partial = { title?: string; imageUrl?: string; priceCents?: number };

function readJsonLdProduct(root: HTMLElement): Partial {
  const scripts = root.querySelectorAll('script[type="application/ld+json"]');
  for (const s of scripts) {
    let data: unknown;
    try {
      data = JSON.parse(s.text);
    } catch {
      continue;
    }
    const product = findProductNode(data);
    if (!product) continue;

    const title =
      typeof product.name === "string" ? product.name : undefined;

    let imageUrl: string | undefined;
    if (typeof product.image === "string") imageUrl = product.image;
    else if (Array.isArray(product.image) && typeof product.image[0] === "string") {
      imageUrl = product.image[0];
    } else if (
      product.image &&
      typeof product.image === "object" &&
      "url" in product.image &&
      typeof product.image.url === "string"
    ) {
      imageUrl = product.image.url;
    }

    let priceCents: number | undefined;
    const offers = product.offers;
    const offer = Array.isArray(offers) ? offers[0] : offers;
    if (offer && typeof offer === "object") {
      const p = (offer as Record<string, unknown>).price;
      const dollars =
        typeof p === "number" ? p : typeof p === "string" ? Number(p) : NaN;
      if (Number.isFinite(dollars) && dollars >= 0) {
        priceCents = Math.round(dollars * 100);
      }
    }

    if (title || imageUrl || priceCents !== undefined) {
      return { title, imageUrl, priceCents };
    }
  }
  return {};
}

function findProductNode(
  data: unknown,
): Record<string, unknown> | null {
  if (!data) return null;
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findProductNode(item);
      if (found) return found;
    }
    return null;
  }
  if (typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  const type = obj["@type"];
  const isProduct =
    type === "Product" ||
    (Array.isArray(type) && type.includes("Product"));
  if (isProduct) return obj;
  if (obj["@graph"]) return findProductNode(obj["@graph"]);
  return null;
}

function readOpenGraph(root: HTMLElement): Partial {
  function meta(prop: string): string | undefined {
    const node = root.querySelector(`meta[property="${prop}"]`);
    return node?.getAttribute("content") ?? undefined;
  }
  const title = meta("og:title");
  const imageUrl = meta("og:image");
  const priceStr =
    meta("og:price:amount") ?? meta("product:price:amount");
  let priceCents: number | undefined;
  if (priceStr) {
    const dollars = Number(priceStr);
    if (Number.isFinite(dollars) && dollars >= 0) {
      priceCents = Math.round(dollars * 100);
    }
  }
  return { title, imageUrl, priceCents };
}

function readMicrodata(root: HTMLElement): Partial {
  const product = root.querySelector('[itemtype$="schema.org/Product"]');
  if (!product) return {};
  const name = product.querySelector('[itemprop="name"]')?.text?.trim();
  const image =
    product.querySelector('[itemprop="image"]')?.getAttribute("src") ??
    undefined;
  const priceStr =
    product
      .querySelector('[itemprop="price"]')
      ?.getAttribute("content") ??
    product.querySelector('[itemprop="price"]')?.text?.trim();
  let priceCents: number | undefined;
  if (priceStr) {
    const dollars = Number(String(priceStr).replace(/[^0-9.]/g, ""));
    if (Number.isFinite(dollars) && dollars >= 0) {
      priceCents = Math.round(dollars * 100);
    }
  }
  return {
    title: name || undefined,
    imageUrl: image,
    priceCents,
  };
}

function toAbsoluteUrl(possiblyRelative: string, baseUrl: string): string {
  try {
    return new URL(possiblyRelative, baseUrl).toString();
  } catch {
    return possiblyRelative;
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add convex/productFetch.ts
git commit -m "feat(registry): OG/JSON-LD/microdata fetcher action"
```

---

### Task C3: Add the paste-URL fetch flow to `/admin/products/new`

**Files:**
- Modify: `src/app/(admin)/admin/products/new/page.tsx`

- [ ] **Step 1: Replace contents of `src/app/(admin)/admin/products/new/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/lib/convex";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ProductForm,
  EMPTY_PRODUCT,
  type ProductFormValues,
} from "@/components/admin/product-form";

export default function NewProductPage() {
  const fetchOg = useAction(api.productFetch.fetchOg);
  const registries = useQuery(api.registries.listAdmin);

  const [url, setUrl] = useState("");
  const [fetching, setFetching] = useState(false);
  const [initial, setInitial] = useState<ProductFormValues | null>(null);
  const [og, setOg] = useState<{ ogTitle?: string; ogImageUrl?: string }>({});
  const [hint, setHint] = useState<string | null>(null);

  function pickDefaultRegistryId(productUrl: string): string {
    if (!registries || registries.length === 0) return "";
    try {
      const host = new URL(productUrl).hostname.toLowerCase();
      const match = registries.find((r) => {
        try {
          return host.endsWith(new URL(r.url).hostname.toLowerCase());
        } catch {
          return false;
        }
      });
      if (match) return match._id;
    } catch {
      // fall through
    }
    return registries[0]._id;
  }

  async function fetchAndOpen() {
    const trimmed = url.trim();
    if (!trimmed) return;
    setFetching(true);
    setHint(null);
    try {
      const res = await fetchOg({ url: trimmed });
      const next: ProductFormValues = {
        ...EMPTY_PRODUCT,
        productUrl: trimmed,
        registryId: pickDefaultRegistryId(trimmed),
      };
      if (res.ok) {
        if (res.fields.title) next.name = res.fields.title;
        if (res.fields.imageUrl) next.imageUrl = res.fields.imageUrl;
        if (res.fields.priceCents !== undefined) {
          next.priceDollars = (res.fields.priceCents / 100).toFixed(2);
        }
        setOg({ ogTitle: res.ogTitle, ogImageUrl: res.ogImageUrl });
        if (
          next.name === "" ||
          next.imageUrl === "" ||
          next.priceDollars === ""
        ) {
          setHint(
            "Found the page but some fields were missing — fill in the rest.",
          );
        }
      } else {
        setOg({});
        if (res.reason === "blocked") {
          setHint("Site blocked our fetch — paste the details manually.");
        } else if (res.reason === "network") {
          setHint(
            "Couldn't reach the page — paste the details manually.",
          );
        } else {
          setHint(
            "Found the page but couldn't read product info — paste the details manually.",
          );
        }
      }
      setInitial(next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fetch failed");
    } finally {
      setFetching(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="font-heading text-3xl">Add product</h1>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-widest text-muted-foreground">
          Product URL
        </Label>
        <div className="flex gap-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste the product page URL"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void fetchAndOpen();
              }
            }}
          />
          <Button onClick={fetchAndOpen} disabled={fetching || !url.trim()}>
            {fetching ? "Fetching…" : "Fetch"}
          </Button>
        </div>
        {hint && (
          <p className="text-sm text-muted-foreground">{hint}</p>
        )}
      </div>

      {initial && (
        <ProductForm initial={initial} ogSnapshot={og} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + browser-verify**

```bash
pnpm typecheck
```

Then in a browser: paste a real retailer product URL into `/admin/products/new`, click Fetch, confirm the form pre-fills for sites that work (e.g., Crate & Barrel JSON-LD), confirm the friendly hint appears for blocked sites (Amazon 503), confirm you can still fill in the form manually and save.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(admin\)/admin/products/new/page.tsx
git commit -m "feat(admin): paste-URL fetch flow for new products"
```

---

### Task C4: Add the refetch + diff UI to product detail page

**Files:**
- Create: `src/components/admin/refetch-diff.tsx`
- Modify: `src/app/(admin)/admin/products/[id]/page.tsx`

- [ ] **Step 1: Create `src/components/admin/refetch-diff.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useAction, useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/lib/convex";
import { type Doc } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";

type Diff = { ogTitle?: string; ogImageUrl?: string };

export function RefetchDiff({ product }: { product: Doc<"registryProducts"> }) {
  const fetchOg = useAction(api.productFetch.fetchOg);
  const applyOgSnapshot = useMutation(api.registryProducts.applyOgSnapshot);
  const update = useMutation(api.registryProducts.update);
  const [busy, setBusy] = useState(false);
  const [diff, setDiff] = useState<Diff | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  async function refetch() {
    setBusy(true);
    setHint(null);
    try {
      const res = await fetchOg({ url: product.productUrl });
      if (res.ok) {
        await applyOgSnapshot({
          id: product._id,
          ogTitle: res.ogTitle,
          ogImageUrl: res.ogImageUrl,
        });
        setDiff({ ogTitle: res.ogTitle, ogImageUrl: res.ogImageUrl });
      } else if (res.reason === "blocked") {
        setHint("Site blocked our fetch.");
      } else if (res.reason === "network") {
        setHint("Couldn't reach the page.");
      } else {
        setHint("No product metadata found.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Refetch failed");
    } finally {
      setBusy(false);
    }
  }

  async function applyField(field: "name" | "imageUrl") {
    const newValue = field === "name" ? diff?.ogTitle : diff?.ogImageUrl;
    if (!newValue) return;
    try {
      await update({
        id: product._id,
        registryId: product.registryId,
        name: field === "name" ? newValue : product.name,
        priceCents: product.priceCents,
        imageUrl: field === "imageUrl" ? newValue : product.imageUrl,
        productUrl: product.productUrl,
        hidden: product.hidden,
      });
      toast.success("Applied");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="rounded-md border border-border p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-medium">Refetch from URL</h3>
          <p className="text-xs text-muted-foreground">
            Pulls the latest title and image from the retailer. Price is never
            overwritten.
          </p>
        </div>
        <Button variant="secondary" onClick={refetch} disabled={busy}>
          {busy ? "Fetching…" : "Refetch"}
        </Button>
      </div>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}

      {diff && (
        <div className="space-y-3 text-sm">
          {diff.ogTitle !== undefined && diff.ogTitle !== product.name && (
            <DiffRow
              label="Title"
              theirs={diff.ogTitle}
              yours={product.name}
              onApply={() => applyField("name")}
            />
          )}
          {diff.ogImageUrl !== undefined &&
            diff.ogImageUrl !== product.imageUrl && (
              <DiffRow
                label="Image URL"
                theirs={diff.ogImageUrl}
                yours={product.imageUrl}
                onApply={() => applyField("imageUrl")}
              />
            )}
          {!fieldDiffers(diff.ogTitle, product.name) &&
            !fieldDiffers(diff.ogImageUrl, product.imageUrl) && (
              <p className="text-muted-foreground">No changes from retailer.</p>
            )}
        </div>
      )}
    </div>
  );
}

function fieldDiffers(theirs: string | undefined, yours: string): boolean {
  return theirs !== undefined && theirs !== yours;
}

function DiffRow({
  label,
  theirs,
  yours,
  onApply,
}: {
  label: string;
  theirs: string;
  yours: string;
  onApply: () => void;
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="text-xs">
        <div className="text-muted-foreground">Retailer: {theirs}</div>
        <div>You: {yours}</div>
      </div>
      <Button size="sm" variant="ghost" onClick={onApply}>
        Apply
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Render the diff component on the detail page**

Modify `src/app/(admin)/admin/products/[id]/page.tsx` to include the refetch panel, a claim toggle, a preview-as-guest link, and the existing form. Replace the file contents with:

```tsx
"use client";

import Link from "next/link";
import { use } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/lib/convex";
import { ProductForm } from "@/components/admin/product-form";
import { RefetchDiff } from "@/components/admin/refetch-diff";
import { Button } from "@/components/ui/button";
import { type Id } from "../../../../../../convex/_generated/dataModel";

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const productId = id as Id<"registryProducts">;
  const product = useQuery(api.registryProducts.get, { id: productId });
  const setClaimed = useMutation(api.registryProducts.setClaimed);

  if (product === undefined) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (product === null) {
    return <p className="text-sm text-muted-foreground">Not found.</p>;
  }

  async function toggleClaimed() {
    try {
      await setClaimed({
        id: productId,
        claimed: product!.claimedAt === undefined,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  const isClaimed = product.claimedAt !== undefined;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="font-heading text-3xl">Edit product</h1>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={toggleClaimed}>
            {isClaimed ? "Mark as available" : "Mark as claimed"}
          </Button>
          <Link
            href={product.productUrl}
            target="_blank"
            rel="noopener"
            className="text-sm underline"
          >
            Preview as guest →
          </Link>
        </div>
      </div>

      <ProductForm
        product={product}
        initial={{
          registryId: product.registryId,
          name: product.name,
          priceDollars: (product.priceCents / 100).toString(),
          imageUrl: product.imageUrl,
          productUrl: product.productUrl,
          hidden: product.hidden,
        }}
      />

      <RefetchDiff product={product} />
    </div>
  );
}
```

- [ ] **Step 3: Typecheck, lint, browser-verify**

```bash
pnpm typecheck && pnpm lint
```

In a browser: open an existing product, click Refetch, confirm OG snapshot fields update and the diff appears when retailer's title/image differ; "Apply" copies the value into the user-facing field. Toggle claimed, confirm the badge appears in the list. The "Preview as guest" link opens the product page on the retailer in a new tab.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/refetch-diff.tsx src/app/\(admin\)/admin/products/\[id\]/page.tsx
git commit -m "feat(admin): refetch diff + claim toggle on product detail"
```

---

## Phase 3d — Public `/registry` page

### Task D1: Public Convex query — paginated curated list

**Files:**
- Modify: `convex/registryProducts.ts`

- [ ] **Step 1: Add the pagination import**

At the top of `convex/registryProducts.ts`, modify the existing `convex/server` import to also pull in `paginationOptsValidator`. Change:

```ts
import { mutation, query } from "./_generated/server";
```

(and any related imports if they were rearranged) — then below it add:

```ts
import { paginationOptsValidator } from "convex/server";
```

- [ ] **Step 2: Append the public query**

Add to the end of `convex/registryProducts.ts`:

```ts
/* ----------------------------------------------------------------------
   Public queries
   -------------------------------------------------------------------- */

const PRICE_BUCKET = v.union(
  v.literal("under_50"),
  v.literal("50_100"),
  v.literal("100_250"),
  v.literal("250_plus"),
);

const SORT = v.union(
  v.literal("featured"),
  v.literal("price_asc"),
  v.literal("price_desc"),
  v.literal("recent"),
);

const PRICE_RANGES: Record<
  "under_50" | "50_100" | "100_250" | "250_plus",
  { min: number; max: number }
> = {
  under_50: { min: 0, max: 5000 - 1 },
  "50_100": { min: 5000, max: 10000 - 1 },
  "100_250": { min: 10000, max: 25000 - 1 },
  "250_plus": { min: 25000, max: Number.MAX_SAFE_INTEGER },
};

export const listPublic = query({
  args: {
    paginationOpts: paginationOptsValidator,
    registryIds: v.optional(v.array(v.id("registries"))),
    priceBucket: v.optional(PRICE_BUCKET),
    hideClaimed: v.optional(v.boolean()),
    sort: v.optional(SORT),
  },
  handler: async (ctx, args) => {
    const sort = args.sort ?? "featured";
    const order = sort === "price_desc" || sort === "recent" ? "desc" : "asc";
    const indexName =
      sort === "featured"
        ? "by_display_order"
        : sort === "recent"
          ? "by_creation_time"
          : "by_price";

    let q;
    if (indexName === "by_creation_time") {
      q = ctx.db.query("registryProducts").order(order);
    } else if (indexName === "by_price") {
      q = ctx.db
        .query("registryProducts")
        .withIndex("by_price", (b) =>
          b.eq("deletedAt", undefined).eq("hidden", false),
        )
        .order(order);
    } else {
      q = ctx.db
        .query("registryProducts")
        .withIndex("by_display_order", (b) =>
          b.eq("deletedAt", undefined).eq("hidden", false),
        )
        .order("asc");
    }

    // Convex's paginate returns a page-at-a-time; we filter in-memory and
    // ask for more pages until the requested page size is satisfied or
    // upstream is exhausted. Caller pages by passing back cursor.
    const result = await q.paginate(args.paginationOpts);

    const registryIdSet = args.registryIds
      ? new Set(args.registryIds)
      : null;
    const range = args.priceBucket ? PRICE_RANGES[args.priceBucket] : null;

    const filtered = result.page.filter((p) => {
      if (p.deletedAt !== undefined) return false;
      if (p.hidden) return false;
      if (registryIdSet && !registryIdSet.has(p.registryId)) return false;
      if (range && (p.priceCents < range.min || p.priceCents > range.max)) {
        return false;
      }
      if (args.hideClaimed && p.claimedAt !== undefined) return false;
      return true;
    });

    // Surface claimed items last when shown.
    const claimedLast = [...filtered].sort((a, b) => {
      const aClaimed = a.claimedAt !== undefined ? 1 : 0;
      const bClaimed = b.claimedAt !== undefined ? 1 : 0;
      return aClaimed - bClaimed;
    });

    return {
      page: claimedLast,
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

export const totalsPublic = query({
  args: {},
  handler: async (ctx) => {
    const rows = (await ctx.db.query("registryProducts").collect()).filter(
      (p) => p.deletedAt === undefined && !p.hidden,
    );
    return { total: rows.length };
  },
});
```

- [ ] **Step 3: Typecheck + commit**

```bash
pnpm typecheck
git add convex/registryProducts.ts
git commit -m "feat(registry): public listPublic query with filters/sort"
```

---

### Task D2: Honeymoon fund public settings + query

**Files:**
- Modify: `convex/settings.ts`

- [ ] **Step 1: Expand `PUBLIC_KEYS` in `convex/settings.ts`**

Replace the existing `PUBLIC_KEYS` constant with:

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
]);
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm typecheck
git add convex/settings.ts
git commit -m "feat(registry): expose honeymoonFund settings publicly"
```

---

### Task D3: Public product card component

**Files:**
- Create: `src/components/public/registry-card.tsx`

- [ ] **Step 1: Create the component**

```tsx
import Image from "next/image";
import { type Doc } from "../../../convex/_generated/dataModel";

export function RegistryCard({
  product,
  registryName,
}: {
  product: Doc<"registryProducts">;
  registryName: string;
}) {
  const claimed = product.claimedAt !== undefined;
  return (
    <a
      href={product.productUrl}
      target="_blank"
      rel="noopener"
      className={`block group rounded-md overflow-hidden border border-border bg-card hover:shadow-sm transition ${
        claimed ? "opacity-60" : ""
      }`}
    >
      <div className="relative aspect-square bg-muted">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="(min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw"
            unoptimized
            className="object-cover"
          />
        ) : null}
        {claimed && (
          <span className="absolute top-2 left-2 text-[10px] uppercase tracking-widest bg-charcoal text-cream px-2 py-1 rounded">
            Already taken
          </span>
        )}
      </div>
      <div className="p-3 space-y-1">
        <div className="text-sm leading-snug line-clamp-2">{product.name}</div>
        <div className="text-sm font-medium">
          ${(product.priceCents / 100).toFixed(0)}
        </div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {registryName}
        </div>
      </div>
    </a>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm typecheck
git add src/components/public/registry-card.tsx
git commit -m "feat(public): registry product card"
```

---

### Task D4: Public registry grid with filter bar + load more

**Files:**
- Create: `src/components/public/registry-grid.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useMemo, useState } from "react";
import { usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@/lib/convex";
import { type Id } from "../../../convex/_generated/dataModel";
import { RegistryCard } from "./registry-card";
import { Button } from "@/components/ui/button";

type PriceBucket = "under_50" | "50_100" | "100_250" | "250_plus";
type Sort = "featured" | "price_asc" | "price_desc" | "recent";

const SORT_LABELS: Record<Sort, string> = {
  featured: "Featured",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
  recent: "Recently added",
};

const PRICE_LABELS: Record<PriceBucket, string> = {
  under_50: "Under $50",
  "50_100": "$50–100",
  "100_250": "$100–250",
  "250_plus": "$250+",
};

export function RegistryGrid() {
  const registries = useQuery(api.registries.listPublic);
  const totals = useQuery(api.registryProducts.totalsPublic);

  const [selectedRegistries, setSelectedRegistries] = useState<
    Set<Id<"registries">>
  >(new Set());
  const [priceBucket, setPriceBucket] = useState<PriceBucket | null>(null);
  const [hideClaimed, setHideClaimed] = useState(false);
  const [sort, setSort] = useState<Sort>("featured");

  const { results, status, loadMore } = usePaginatedQuery(
    api.registryProducts.listPublic,
    {
      registryIds:
        selectedRegistries.size > 0
          ? Array.from(selectedRegistries)
          : undefined,
      priceBucket: priceBucket ?? undefined,
      hideClaimed: hideClaimed || undefined,
      sort,
    },
    { initialNumItems: 24 },
  );

  const registryMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of registries ?? []) m.set(r._id, r.name);
    return m;
  }, [registries]);

  const filtersActive =
    selectedRegistries.size > 0 ||
    priceBucket !== null ||
    hideClaimed ||
    sort !== "featured";

  function reset() {
    setSelectedRegistries(new Set());
    setPriceBucket(null);
    setHideClaimed(false);
    setSort("featured");
  }

  function toggleRegistry(id: Id<"registries">) {
    setSelectedRegistries((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 bg-cream/95 backdrop-blur py-3 border-b border-border">
        <div className="flex flex-wrap gap-2 items-center">
          {(registries ?? []).map((r) => {
            const active = selectedRegistries.has(r._id);
            return (
              <button
                key={r._id}
                type="button"
                onClick={() => toggleRegistry(r._id)}
                className={`text-xs uppercase tracking-widest px-3 py-1 rounded-full border ${
                  active
                    ? "bg-foreground text-background border-foreground"
                    : "bg-transparent border-border hover:bg-muted"
                }`}
              >
                {r.name}
              </button>
            );
          })}

          <span className="mx-2 h-4 w-px bg-border" />

          {(Object.keys(PRICE_LABELS) as PriceBucket[]).map((bucket) => {
            const active = priceBucket === bucket;
            return (
              <button
                key={bucket}
                type="button"
                onClick={() =>
                  setPriceBucket((cur) => (cur === bucket ? null : bucket))
                }
                className={`text-xs uppercase tracking-widest px-3 py-1 rounded-full border ${
                  active
                    ? "bg-foreground text-background border-foreground"
                    : "bg-transparent border-border hover:bg-muted"
                }`}
              >
                {PRICE_LABELS[bucket]}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setHideClaimed((v) => !v)}
            className={`text-xs uppercase tracking-widest px-3 py-1 rounded-full border ${
              hideClaimed
                ? "bg-foreground text-background border-foreground"
                : "bg-transparent border-border hover:bg-muted"
            }`}
          >
            Hide claimed
          </button>

          <span className="ml-auto flex items-center gap-2">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="text-xs uppercase tracking-widest bg-transparent border border-border rounded-full px-3 py-1"
            >
              {(Object.keys(SORT_LABELS) as Sort[]).map((s) => (
                <option key={s} value={s}>
                  {SORT_LABELS[s]}
                </option>
              ))}
            </select>
            {filtersActive && (
              <Button variant="ghost" size="sm" onClick={reset}>
                Reset
              </Button>
            )}
          </span>
        </div>
        {totals && (
          <p className="text-xs text-muted-foreground mt-2">
            Showing {results.length} of {totals.total}
          </p>
        )}
      </div>

      {results.length === 0 && status !== "LoadingFirstPage" ? (
        <p className="text-sm text-muted-foreground text-center py-12">
          Nothing matches those filters.{" "}
          {filtersActive && (
            <button onClick={reset} className="underline">
              Reset
            </button>
          )}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {results.map((p) => (
            <RegistryCard
              key={p._id}
              product={p}
              registryName={registryMap.get(p.registryId) ?? ""}
            />
          ))}
        </div>
      )}

      {status === "CanLoadMore" && (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={() => loadMore(24)}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm typecheck
git add src/components/public/registry-grid.tsx
git commit -m "feat(public): registry filter bar + paginated grid"
```

---

### Task D5: Honeymoon hero + registry hub strip components

**Files:**
- Create: `src/components/public/honeymoon-hero.tsx`
- Create: `src/components/public/registry-hub.tsx`

- [ ] **Step 1: Create `honeymoon-hero.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/lib/convex";

export function HoneymoonHero() {
  const settings = useQuery(api.settings.publicSettings);
  if (settings === undefined) return null;
  if (settings["honeymoonFund.enabled"] !== true) return null;

  const headline =
    (settings["honeymoonFund.headline"] as string | undefined) ?? "";
  const blurb =
    (settings["honeymoonFund.blurb"] as string | undefined) ?? "";
  const ctaUrl =
    (settings["honeymoonFund.ctaUrl"] as string | undefined) ?? "";
  const ctaLabel =
    (settings["honeymoonFund.ctaLabel"] as string | undefined) ?? "Contribute";

  if (!ctaUrl) return null;

  return (
    <section className="rounded-lg bg-blush/40 border border-blush p-8 sm:p-12 text-center space-y-4">
      {headline && (
        <h2 className="font-heading text-4xl sm:text-5xl">{headline}</h2>
      )}
      {blurb && <p className="text-sm sm:text-base max-w-prose mx-auto">{blurb}</p>}
      <Link
        href={ctaUrl}
        target="_blank"
        rel="noopener"
        className="inline-block bg-charcoal text-cream tracking-[0.3em] uppercase text-xs px-8 py-3 rounded-full hover:bg-charcoal/90"
      >
        {ctaLabel} →
      </Link>
    </section>
  );
}
```

- [ ] **Step 2: Create `registry-hub.tsx`**

```tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/lib/convex";

export function RegistryHub() {
  const registries = useQuery(api.registries.listPublic);
  if (!registries || registries.length === 0) return null;

  return (
    <section className="space-y-4">
      <h3 className="font-heading text-2xl text-center">
        Where we&apos;re registered
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {registries.map((r) => (
          <Link
            key={r._id}
            href={r.url}
            target="_blank"
            rel="noopener"
            className="aspect-[2/1] rounded-md border border-border bg-card flex items-center justify-center p-4 hover:shadow-sm transition"
          >
            {r.logoUrl ? (
              <Image
                src={r.logoUrl}
                alt={r.name}
                width={120}
                height={48}
                unoptimized
                className="object-contain max-h-full"
              />
            ) : (
              <span className="font-heading text-lg">{r.name}</span>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Typecheck + commit**

```bash
pnpm typecheck
git add src/components/public/honeymoon-hero.tsx src/components/public/registry-hub.tsx
git commit -m "feat(public): honeymoon hero + registry hub strip"
```

---

### Task D6: Wire `/registry` route

**Files:**
- Create: `src/app/registry/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
import { HoneymoonHero } from "@/components/public/honeymoon-hero";
import { RegistryHub } from "@/components/public/registry-hub";
import { RegistryGrid } from "@/components/public/registry-grid";

// Convex-backed components below — skip static prerender.
export const dynamic = "force-dynamic";

export default function RegistryPage() {
  return (
    <div className="flex-1 bg-cream text-charcoal">
      <div className="mx-auto max-w-6xl px-6 py-16 space-y-16">
        <HoneymoonHero />
        <RegistryHub />
        <section className="space-y-6">
          <h3 className="font-heading text-2xl text-center">
            A few of our picks
          </h3>
          <RegistryGrid />
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck, lint, browser-verify**

```bash
pnpm typecheck && pnpm lint
```

In a headed browser: visit `/registry`. Confirm hero renders when fund is enabled, hub renders, grid renders, filters work (registry chips, price buckets, hide-claimed), sort changes results, "Load more" appends, claimed cards drop to the end with opacity 60%, reset clears filters. Check responsive layout at xs/sm/md.

- [ ] **Step 3: Commit**

```bash
git add src/app/registry/page.tsx
git commit -m "feat(public): /registry page wiring hero + hub + grid"
```

---

## Phase 3e — Honeymoon fund settings

### Task E1: Add honeymoon fund section to admin settings

**Files:**
- Modify: `src/app/(admin)/admin/settings/page.tsx`

- [ ] **Step 1: Add the state, getters, save calls, and JSX section**

Inside `SettingsPage` in `src/app/(admin)/admin/settings/page.tsx`, add the following state declarations right after the existing `notificationsEdit` declaration:

```tsx
  const [fundEnabledEdit, setFundEnabledEdit] =
    useState<Edited<boolean>>(null);
  const [fundHeadlineEdit, setFundHeadlineEdit] =
    useState<Edited<string>>(null);
  const [fundBlurbEdit, setFundBlurbEdit] =
    useState<Edited<string>>(null);
  const [fundCtaUrlEdit, setFundCtaUrlEdit] =
    useState<Edited<string>>(null);
  const [fundCtaLabelEdit, setFundCtaLabelEdit] =
    useState<Edited<string>>(null);
```

Then add the matching computed values right after the existing `notificationsOn` constant:

```tsx
  const fundEnabled =
    fundEnabledEdit ??
    (settings?.["honeymoonFund.enabled"] as boolean | null) ??
    false;
  const fundHeadline =
    fundHeadlineEdit ??
    (settings?.["honeymoonFund.headline"] as string | null) ??
    "";
  const fundBlurb =
    fundBlurbEdit ??
    (settings?.["honeymoonFund.blurb"] as string | null) ??
    "";
  const fundCtaUrl =
    fundCtaUrlEdit ??
    (settings?.["honeymoonFund.ctaUrl"] as string | null) ??
    "";
  const fundCtaLabel =
    fundCtaLabelEdit ??
    (settings?.["honeymoonFund.ctaLabel"] as string | null) ??
    "Contribute";
```

Inside the `save` function's `Promise.all([ ... ])`, add five more `setSetting` calls before the `setNotifications` call:

```tsx
          setSetting({
            key: "honeymoonFund.enabled",
            value: fundEnabled,
          }),
          setSetting({
            key: "honeymoonFund.headline",
            value: fundHeadline.trim() || null,
          }),
          setSetting({
            key: "honeymoonFund.blurb",
            value: fundBlurb.trim() || null,
          }),
          setSetting({
            key: "honeymoonFund.ctaUrl",
            value: fundCtaUrl.trim() || null,
          }),
          setSetting({
            key: "honeymoonFund.ctaLabel",
            value: fundCtaLabel.trim() || "Contribute",
          }),
```

In the success branch (where the other `set*Edit(null)` calls are), append:

```tsx
        setFundEnabledEdit(null);
        setFundHeadlineEdit(null);
        setFundBlurbEdit(null);
        setFundCtaUrlEdit(null);
        setFundCtaLabelEdit(null);
```

Finally, add the `<section>` for the fund just before the `pt-4 border-t border-border` button row at the bottom of the JSX:

```tsx
      <section className="space-y-4">
        <h2 className="font-heading text-xl">Honeymoon fund</h2>
        <div className="flex items-center gap-2">
          <Checkbox
            id="fund-enabled"
            checked={fundEnabled}
            onCheckedChange={(v) => setFundEnabledEdit(v === true)}
          />
          <Label htmlFor="fund-enabled">
            Show the honeymoon-fund hero on the registry page
          </Label>
        </div>
        <div className="space-y-1">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">
            Headline
          </Label>
          <Input
            value={fundHeadline}
            onChange={(e) => setFundHeadlineEdit(e.target.value)}
            placeholder="Help us see Patagonia"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">
            Blurb
          </Label>
          <Input
            value={fundBlurb}
            onChange={(e) => setFundBlurbEdit(e.target.value)}
            placeholder="Any contribution means the world."
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-4">
          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
              CTA URL
            </Label>
            <Input
              value={fundCtaUrl}
              onChange={(e) => setFundCtaUrlEdit(e.target.value)}
              placeholder="https://www.honeyfund.com/..."
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
              CTA label
            </Label>
            <Input
              value={fundCtaLabel}
              onChange={(e) => setFundCtaLabelEdit(e.target.value)}
              placeholder="Contribute"
            />
          </div>
        </div>
      </section>
```

- [ ] **Step 2: Typecheck, lint, browser-verify**

```bash
pnpm typecheck && pnpm lint
```

In a browser: open `/admin/settings`, enter fund details, save, navigate to `/registry`, confirm the hero appears with the configured headline/blurb/CTA. Toggle the enabled checkbox off, save, refresh `/registry`, confirm the hero is hidden.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(admin\)/admin/settings/page.tsx
git commit -m "feat(admin): honeymoon fund settings section"
```

---

## Phase 3f — Final integration pass

### Task F1: Link `/registry` from the public home page

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add a Registry link near the RSVP CTA**

In `src/app/page.tsx`, just after the RSVP `Link` in the `<div className="mt-12 flex justify-center">`, expand it to a flex row with two CTAs:

Replace:

```tsx
          <div className="mt-12 flex justify-center">
            <Link
              href="/rsvp"
              // Inline padding bypasses the size variant's sm:px-2.5
              // override. The +0.3em on the left compensates for the
              // trailing letter-spacing so the glyphs read as centered.
              style={{
                paddingLeft: "calc(2.5rem + 0.3em)",
                paddingRight: "2.5rem",
              }}
              className={cn(
                buttonVariants({ variant: "default" }),
                "h-12 text-sm tracking-[0.3em] uppercase",
              )}
            >
              RSVP
            </Link>
          </div>
```

with:

```tsx
          <div className="mt-12 flex flex-wrap justify-center gap-3">
            <Link
              href="/rsvp"
              style={{
                paddingLeft: "calc(2.5rem + 0.3em)",
                paddingRight: "2.5rem",
              }}
              className={cn(
                buttonVariants({ variant: "default" }),
                "h-12 text-sm tracking-[0.3em] uppercase",
              )}
            >
              RSVP
            </Link>
            <Link
              href="/registry"
              style={{
                paddingLeft: "calc(2.5rem + 0.3em)",
                paddingRight: "2.5rem",
              }}
              className={cn(
                buttonVariants({ variant: "secondary" }),
                "h-12 text-sm tracking-[0.3em] uppercase",
              )}
            >
              Registry
            </Link>
          </div>
```

- [ ] **Step 2: Typecheck, lint, browser-verify**

```bash
pnpm typecheck && pnpm lint
```

Browser-check: home page shows both RSVP and Registry CTAs side-by-side on `sm+` and stacked on `xs`.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(public): add Registry CTA to home page"
```

---

### Task F2: End-to-end smoke test

- [ ] **Step 1: Run a full headed-browser smoke pass**

Use a headed Playwright session per project memory (no manual instructions to user, no headless). Cover:

1. Admin signs in.
2. Add two registries (Crate & Barrel + REI + Honeyfund).
3. Add 6 products: 2 via paste-URL fetch (a working JSON-LD site + a blocked one), 4 manually. Set varied prices and at least one to $40, one to $300.
4. Mark one product as claimed.
5. Open `/admin/settings`, fill the honeymoon-fund fields, enable, save.
6. Navigate to `/registry`. Verify:
   - Hero renders with the configured headline + CTA.
   - Hub strip shows all three registries.
   - Grid shows 6 products. Claimed product is at the end with opacity.
   - Filtering by store, by price bucket ("Under $50"), and toggling "Hide claimed" works.
   - Sort by "Price: low to high" reorders.
   - "Load more" exists if total > 24 (skip if you don't have 24 products handy).
7. Disable the fund toggle in admin, refresh `/registry`, confirm hero disappears.

- [ ] **Step 2: Final typecheck + lint**

```bash
pnpm typecheck && pnpm lint
```

- [ ] **Step 3: No commit needed**

This step is verification only. If any issues turned up, open a follow-up task per defect.

---

## Self-review summary

**Spec coverage:** Every Decisions row and every Section in the spec is implemented by a task:

| Spec topic | Task(s) |
|---|---|
| `registries`/`registryProducts` schema + indexes | A1 |
| Soft delete, drag-reorder | A2, B1 |
| Registry CRUD admin | A2, A4–A6 |
| Product CRUD admin | B1, B3–B5 |
| Manual claim toggle, "Already taken" badge | B1, B4, C4, D3 |
| OG/JSON-LD/microdata fetch action + UA + 8s timeout | C1, C2 |
| Paste-URL fetch flow with fallback messages | C3 |
| Refetch with per-field diff/Apply | C4 |
| Honeymoon fund settings keys + admin UI | D2, E1 |
| Honeymoon fund hero (public) | D5, D6 |
| Hub strip (public) | D5, D6 |
| Curated grid with Store/Price/Hide-claimed filters, sort, load-more | D1, D3, D4, D6 |
| Auto-claim research (no-op, documented in spec) | — |
| Out-of-scope items | not built (correct) |
| Phased build 3a–3e | mapped 1:1 to Phase 3a–3e sections above; 3f is the integration polish |

No placeholders. Types and identifiers are consistent across tasks (`Doc<"registries">`, `Id<"registryProducts">`, `parsePriceToCents`, `applyOgSnapshot`, `RegistryFormValues`, `ProductFormValues`).

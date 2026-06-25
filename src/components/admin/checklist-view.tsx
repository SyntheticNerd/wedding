"use client";

import { useMemo, useState, useTransition } from "react";
import { useMutation, useQuery } from "convex/react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/convex";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/vendor-categories";
import { SECTION_ORDER } from "../../../convex/lib/checklistDefaults";
import {
  ChecklistItemRow,
  type ChecklistListItem,
} from "./checklist-item-row";

const NO_CATEGORY = "__none__";

export function ChecklistView() {
  const items = useQuery(api.checklist.list);
  const [hideCompleted, setHideCompleted] = useState(false);

  if (items === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (items.length === 0) {
    return <EmptyState />;
  }

  const total = items.length;
  const done = items.filter((i) => i.done).length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <div className="space-y-6">
      <ProgressBar done={done} total={total} percent={percent} />

      <AddForm />

      <div className="flex items-center justify-end">
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <Checkbox
            checked={hideCompleted}
            onCheckedChange={(v) => setHideCompleted(v === true)}
          />
          Hide completed
        </label>
      </div>

      <Sections items={items} hideCompleted={hideCompleted} />
    </div>
  );
}

function Sections({
  items,
  hideCompleted,
}: {
  items: ChecklistListItem[];
  hideCompleted: boolean;
}) {
  const sections = useMemo(() => groupBySection(items), [items]);

  const visible = sections
    .map((s) => ({
      ...s,
      rows: hideCompleted ? s.rows.filter((r) => !r.done) : s.rows,
    }))
    .filter((s) => s.rows.length > 0);

  if (visible.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Everything here is done. 🎉
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {visible.map((section) => {
        const sectionDone = section.rows.filter((r) => r.done).length;
        return (
          <div
            key={section.name}
            className="rounded-lg border border-border bg-card overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b border-border">
              <h2 className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">
                {section.name}
              </h2>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {sectionDone}/{section.rows.length}
              </span>
            </div>
            <div className="divide-y divide-border">
              {section.rows.map((item) => (
                <ChecklistItemRow key={item._id} item={item} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ProgressBar({
  done,
  total,
  percent,
}: {
  done: number;
  total: number;
  percent: number;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-sm font-medium">
          {done} of {total} done
        </span>
        <span className="text-sm text-muted-foreground tabular-nums">
          {percent}%
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-[var(--status-yes)] transition-[width] duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function AddForm() {
  const add = useMutation(api.checklist.add);
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [section, setSection] = useState<string>(SECTION_ORDER[0]);
  const [category, setCategory] = useState<string>(NO_CATEGORY);

  function submit() {
    const trimmed = title.trim();
    if (!trimmed) {
      toast.error("Enter a task");
      return;
    }
    startTransition(async () => {
      try {
        await add({
          title: trimmed,
          section,
          category: category === NO_CATEGORY ? undefined : category,
        });
        setTitle("");
        // Keep section/category sticky so adding several to one area is quick.
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to add");
      }
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="rounded-lg border border-border bg-card p-3 flex flex-col sm:flex-row gap-2"
    >
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Add a task…"
        className="flex-1"
        aria-label="New task"
      />
      <div className="flex gap-2">
        <Select value={section} onValueChange={(v) => v != null && setSection(v)}>
          <SelectTrigger className="w-[10.5rem]" aria-label="Section">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SECTION_ORDER.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={category}
          onValueChange={(v) => v != null && setCategory(v)}
        >
          <SelectTrigger className="w-[9.5rem]" aria-label="Linked vendor category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_CATEGORY}>No vendor link</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" disabled={pending} aria-label="Add task">
          <Plus className="size-4" />
          Add
        </Button>
      </div>
    </form>
  );
}

function EmptyState() {
  const seed = useMutation(api.checklist.seedDefaults);
  const add = useMutation(api.checklist.add);
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");

  function populate() {
    startTransition(async () => {
      try {
        const res = await seed({});
        if (res.skipped) toast.message("Checklist already has items");
        else toast.success(`Added ${res.inserted} starter tasks`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  function addOne() {
    const trimmed = title.trim();
    if (!trimmed) return;
    startTransition(async () => {
      try {
        await add({ title: trimmed, section: SECTION_ORDER[0] });
        setTitle("");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center space-y-5">
      <div className="space-y-1">
        <p className="font-heading text-xl">Start your planning checklist</p>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Populate a curated starter list — florals, cake, DJ, decor, attire,
          paperwork and more — each tied to your vendor list. You can edit,
          add, and remove anything.
        </p>
      </div>
      <Button onClick={populate} disabled={pending}>
        Populate starter checklist
      </Button>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          addOne();
        }}
        className="flex gap-2 max-w-md mx-auto pt-2"
      >
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="…or add your own first task"
          aria-label="New task"
        />
        <Button type="submit" variant="outline" disabled={pending}>
          Add
        </Button>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function groupBySection(
  items: ChecklistListItem[],
): { name: string; rows: ChecklistListItem[] }[] {
  const map = new Map<string, ChecklistListItem[]>();
  for (const item of items) {
    const arr = map.get(item.section) ?? [];
    arr.push(item);
    map.set(item.section, arr);
  }

  const ordered: string[] = [
    ...SECTION_ORDER.filter((s) => map.has(s)),
    ...Array.from(map.keys())
      .filter((s) => !SECTION_ORDER.includes(s as (typeof SECTION_ORDER)[number]))
      .sort((a, b) => a.localeCompare(b)),
  ];

  return ordered.map((name) => ({ name, rows: map.get(name) ?? [] }));
}

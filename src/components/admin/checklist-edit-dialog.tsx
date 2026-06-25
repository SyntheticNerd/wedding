"use client";

import { useState, useTransition } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/lib/convex";
import type { Doc } from "@/lib/convex";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/vendor-categories";
import { SECTION_ORDER } from "../../../convex/lib/checklistDefaults";

const NO_CATEGORY = "__none__";

export function ChecklistEditDialog({
  item,
  open,
  onOpenChange,
}: {
  item: Doc<"checklistItems">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const update = useMutation(api.checklist.update);
  const [pending, startTransition] = useTransition();

  const [title, setTitle] = useState(item.title);
  const [section, setSection] = useState(item.section);
  const [category, setCategory] = useState(item.category ?? NO_CATEGORY);
  const [notes, setNotes] = useState(item.notes ?? "");
  const [dueAt, setDueAt] = useState(
    item.dueAt ? new Date(item.dueAt).toISOString().slice(0, 10) : "",
  );

  // The dialog is mounted fresh each time a row enters edit mode, so the
  // state initializers above already reflect the current item — no effect
  // needed to re-seed.

  // Sections offered: the canonical list plus the item's own (in case it was
  // a custom one), de-duplicated and order-preserved.
  const sectionOptions = Array.from(
    new Set<string>([...SECTION_ORDER, item.section]),
  );

  function save() {
    startTransition(async () => {
      const trimmed = title.trim();
      if (!trimmed) {
        toast.error("Title is required");
        return;
      }
      try {
        await update({
          id: item._id,
          title: trimmed,
          section: section.trim() || "General",
          category: category === NO_CATEGORY ? undefined : category,
          notes: notes.trim() || undefined,
          dueAt: dueAt ? new Date(`${dueAt}T00:00:00`).getTime() : undefined,
        });
        toast.success("Saved");
        onOpenChange(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit task</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Field label="Task">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Section">
              <Select
                value={section}
                onValueChange={(v) => v != null && setSection(v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sectionOptions.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Linked vendor category">
              <Select
                value={category}
                onValueChange={(v) => v != null && setCategory(v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CATEGORY}>None</SelectItem>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Due date (optional)">
            <Input
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
            />
          </Field>

          <Field label="Notes (optional)">
            <Textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything to remember…"
            />
          </Field>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button onClick={save} disabled={pending}>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

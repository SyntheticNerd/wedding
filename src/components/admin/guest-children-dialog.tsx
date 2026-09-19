"use client";

import { useState, useTransition } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { api } from "@/lib/convex";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

/**
 * Quick-add children to one household. Enter each child's name (one field per
 * child); each becomes a real child guest in the invitation group. Mobile-first:
 * full-width stacked fields, large tap targets, one clear primary action.
 */
export function GuestChildrenDialog({
  invitationId,
  householdLabel,
  defaultLastName,
  open,
  onOpenChange,
}: {
  invitationId: string;
  householdLabel: string;
  /** Inherited from the household; when absent we ask for it. */
  defaultLastName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const addChildren = useMutation(api.guests.addChildren);
  const [pending, startTransition] = useTransition();
  const [names, setNames] = useState<string[]>([""]);
  const [lastName, setLastName] = useState(defaultLastName ?? "");

  const filledCount = names.filter((n) => n.trim()).length;

  function setName(i: number, value: string) {
    setNames((prev) => prev.map((n, idx) => (idx === i ? value : n)));
  }
  function addRow() {
    setNames((prev) => [...prev, ""]);
  }
  function removeRow(i: number) {
    setNames((prev) =>
      prev.length === 1 ? [""] : prev.filter((_, idx) => idx !== i),
    );
  }

  function submit() {
    const cleaned = names.map((n) => n.trim()).filter(Boolean);
    if (cleaned.length === 0) {
      toast.error("Enter at least one child's name");
      return;
    }
    startTransition(async () => {
      try {
        const res = await addChildren({
          invitationId,
          names: cleaned,
          lastName: lastName.trim() || undefined,
        });
        toast.success(
          `Added ${res.inserted} child${res.inserted === 1 ? "" : "ren"}`,
        );
        setNames([""]);
        onOpenChange(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't add children");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add children</DialogTitle>
          <DialogDescription>
            To {householdLabel}. Each name becomes a child guest in this
            invitation group.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="space-y-4"
        >
          {!defaultLastName && (
            <div className="space-y-1">
              <Label
                htmlFor="children-lastname"
                className="text-xs uppercase tracking-widest text-muted-foreground"
              >
                Last name
              </Label>
              <Input
                id="children-lastname"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Shared by all the children"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
              Children&apos;s names
            </Label>
            {names.map((name, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={name}
                  onChange={(e) => setName(i, e.target.value)}
                  placeholder={`Child ${i + 1}`}
                  autoFocus={i === names.length - 1 && names.length > 1}
                  aria-label={`Child ${i + 1} name`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRow(i)}
                  aria-label={`Remove child ${i + 1}`}
                  className="shrink-0"
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addRow}
              className="w-full sm:w-auto"
            >
              <Plus className="size-4" />
              Add another child
            </Button>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending || filledCount === 0}>
              {filledCount === 0
                ? "Add children"
                : `Add ${filledCount} child${filledCount === 1 ? "" : "ren"}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

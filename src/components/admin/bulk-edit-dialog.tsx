"use client";

import { useEffect, useState, useTransition } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api, type Id } from "@/lib/convex";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/* Each editable field has its own opt-in toggle so partial edits never
   accidentally clobber unrelated data. The patch object only carries
   keys whose toggle is on. */
type Side = "bride" | "groom" | "both";
type RsvpStatus = "pending" | "yes" | "no";

interface FormState {
  side: { on: boolean; value: Side };
  isChild: { on: boolean; value: boolean };
  plusOneAllowed: { on: boolean; value: boolean };
  rsvpStatus: { on: boolean; value: RsvpStatus };
  rsvpOffline: { on: boolean; value: boolean };
  invitationId: { on: boolean; value: string };
  address: {
    on: boolean;
    line1: string;
    line2: string;
    city: string;
    region: string;
    postalCode: string;
    country: string;
  };
  adminNotes: { on: boolean; value: string; mode: "replace" | "append" };
}

const blank: FormState = {
  side: { on: false, value: "bride" },
  isChild: { on: false, value: false },
  plusOneAllowed: { on: false, value: false },
  rsvpStatus: { on: false, value: "pending" },
  rsvpOffline: { on: false, value: false },
  invitationId: { on: false, value: "" },
  address: {
    on: false,
    line1: "",
    line2: "",
    city: "",
    region: "",
    postalCode: "",
    country: "",
  },
  adminNotes: { on: false, value: "", mode: "replace" },
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ids: Id<"guests">[];
  onApplied: () => void;
}

export function BulkEditDialog({ open, onOpenChange, ids, onApplied }: Props) {
  const [state, setState] = useState<FormState>(blank);
  const [pending, startTransition] = useTransition();
  const bulkUpdate = useMutation(api.guests.bulkUpdate);

  // Reset toggles every time the dialog closes — covers Cancel button,
  // X button, Escape key, click-outside, and post-apply close uniformly.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!open) setState(blank);
  }, [open]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const patch: Record<string, unknown> = {};
    if (state.side.on) patch.side = state.side.value;
    if (state.isChild.on) patch.isChild = state.isChild.value;
    if (state.plusOneAllowed.on) {
      patch.plusOneAllowed = state.plusOneAllowed.value;
    }
    if (state.rsvpStatus.on) patch.rsvpStatus = state.rsvpStatus.value;
    if (state.rsvpOffline.on) patch.rsvpOffline = state.rsvpOffline.value;
    if (state.invitationId.on) {
      const trimmed = state.invitationId.value.trim();
      if (!trimmed) {
        toast.error("Invitation can't be empty when toggled.");
        return;
      }
      patch.invitationId = trimmed;
    }
    if (state.address.on) {
      const a = {
        line1: state.address.line1.trim(),
        line2: state.address.line2.trim(),
        city: state.address.city.trim(),
        region: state.address.region.trim(),
        postalCode: state.address.postalCode.trim(),
        country: state.address.country.trim(),
      };
      const missing = (
        ["line1", "city", "region", "postalCode", "country"] as const
      ).filter((k) => !a[k]);
      if (missing.length > 0) {
        toast.error(`Address needs: ${missing.join(", ")}`);
        return;
      }
      patch.address = {
        line1: a.line1,
        line2: a.line2 || undefined,
        city: a.city,
        region: a.region,
        postalCode: a.postalCode,
        country: a.country,
      };
    }
    if (state.adminNotes.on) {
      const incoming = state.adminNotes.value.trim();
      if (state.adminNotes.mode === "append" && !incoming) {
        toast.error("Append mode needs note content (use Replace to clear).");
        return;
      }
      patch.adminNotes = state.adminNotes.value;
      patch.adminNotesMode = state.adminNotes.mode;
    }

    if (Object.keys(patch).length === 0) {
      toast.error("Toggle at least one field to apply.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await bulkUpdate({ ids, patch });
        toast.success(
          `Updated ${result.updated} guest${result.updated === 1 ? "" : "s"}.`,
        );
        onApplied();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Bulk edit failed");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {ids.length} guest{ids.length === 1 ? "" : "s"}</DialogTitle>
          <DialogDescription>
            Toggle a field to include it in the update. Untoggled fields
            stay untouched on every selected guest.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-3">
          <Toggleable
            label="Side"
            on={state.side.on}
            onToggle={(on) =>
              setState((s) => ({ ...s, side: { ...s.side, on } }))
            }
          >
            <Select
              value={state.side.value}
              onValueChange={(v) =>
                setState((s) => ({
                  ...s,
                  side: { ...s.side, value: v as Side },
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bride">Bride</SelectItem>
                <SelectItem value="groom">Groom</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
          </Toggleable>

          <Toggleable
            label="Child"
            on={state.isChild.on}
            onToggle={(on) =>
              setState((s) => ({ ...s, isChild: { ...s.isChild, on } }))
            }
          >
            <BoolPicker
              value={state.isChild.value}
              onChange={(v) =>
                setState((s) => ({
                  ...s,
                  isChild: { ...s.isChild, value: v },
                }))
              }
              labelTrue="Yes (child)"
              labelFalse="No (adult)"
            />
          </Toggleable>

          <Toggleable
            label="Plus-one allowed"
            on={state.plusOneAllowed.on}
            onToggle={(on) =>
              setState((s) => ({
                ...s,
                plusOneAllowed: { ...s.plusOneAllowed, on },
              }))
            }
          >
            <BoolPicker
              value={state.plusOneAllowed.value}
              onChange={(v) =>
                setState((s) => ({
                  ...s,
                  plusOneAllowed: { ...s.plusOneAllowed, value: v },
                }))
              }
              labelTrue="Allowed"
              labelFalse="Not allowed"
            />
          </Toggleable>

          <Toggleable
            label="RSVP status"
            on={state.rsvpStatus.on}
            onToggle={(on) =>
              setState((s) => ({ ...s, rsvpStatus: { ...s.rsvpStatus, on } }))
            }
          >
            <Select
              value={state.rsvpStatus.value}
              onValueChange={(v) =>
                setState((s) => ({
                  ...s,
                  rsvpStatus: { ...s.rsvpStatus, value: v as RsvpStatus },
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="yes">Yes</SelectItem>
                <SelectItem value="no">No</SelectItem>
              </SelectContent>
            </Select>
          </Toggleable>

          <Toggleable
            label="RSVP'd offline"
            on={state.rsvpOffline.on}
            onToggle={(on) =>
              setState((s) => ({
                ...s,
                rsvpOffline: { ...s.rsvpOffline, on },
              }))
            }
          >
            <BoolPicker
              value={state.rsvpOffline.value}
              onChange={(v) =>
                setState((s) => ({
                  ...s,
                  rsvpOffline: { ...s.rsvpOffline, value: v },
                }))
              }
              labelTrue="Offline"
              labelFalse="Online (form)"
            />
          </Toggleable>

          <Toggleable
            label="Invitation (household)"
            on={state.invitationId.on}
            onToggle={(on) =>
              setState((s) => ({
                ...s,
                invitationId: { ...s.invitationId, on },
              }))
            }
          >
            <Input
              value={state.invitationId.value}
              onChange={(e) =>
                setState((s) => ({
                  ...s,
                  invitationId: {
                    ...s.invitationId,
                    value: e.target.value,
                  },
                }))
              }
              placeholder="e.g. INV-ABCD-1234 or 'evangelista'"
            />
          </Toggleable>

          <Toggleable
            label="Address"
            on={state.address.on}
            onToggle={(on) =>
              setState((s) => ({ ...s, address: { ...s.address, on } }))
            }
          >
            <div className="grid gap-2">
              <Input
                placeholder="Address line 1"
                value={state.address.line1}
                onChange={(e) =>
                  setState((s) => ({
                    ...s,
                    address: { ...s.address, line1: e.target.value },
                  }))
                }
              />
              <Input
                placeholder="Address line 2"
                value={state.address.line2}
                onChange={(e) =>
                  setState((s) => ({
                    ...s,
                    address: { ...s.address, line2: e.target.value },
                  }))
                }
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="City"
                  value={state.address.city}
                  onChange={(e) =>
                    setState((s) => ({
                      ...s,
                      address: { ...s.address, city: e.target.value },
                    }))
                  }
                />
                <Input
                  placeholder="Region/State"
                  value={state.address.region}
                  onChange={(e) =>
                    setState((s) => ({
                      ...s,
                      address: { ...s.address, region: e.target.value },
                    }))
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Postal code"
                  value={state.address.postalCode}
                  onChange={(e) =>
                    setState((s) => ({
                      ...s,
                      address: {
                        ...s.address,
                        postalCode: e.target.value,
                      },
                    }))
                  }
                />
                <Input
                  placeholder="Country"
                  value={state.address.country}
                  onChange={(e) =>
                    setState((s) => ({
                      ...s,
                      address: { ...s.address, country: e.target.value },
                    }))
                  }
                />
              </div>
            </div>
          </Toggleable>

          <Toggleable
            label="Admin notes"
            on={state.adminNotes.on}
            onToggle={(on) =>
              setState((s) => ({
                ...s,
                adminNotes: { ...s.adminNotes, on },
              }))
            }
          >
            <div className="space-y-2">
              <div className="flex items-center gap-4 text-xs">
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="adminNotesMode"
                    checked={state.adminNotes.mode === "replace"}
                    onChange={() =>
                      setState((s) => ({
                        ...s,
                        adminNotes: { ...s.adminNotes, mode: "replace" },
                      }))
                    }
                  />
                  Replace existing
                </label>
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="adminNotesMode"
                    checked={state.adminNotes.mode === "append"}
                    onChange={() =>
                      setState((s) => ({
                        ...s,
                        adminNotes: { ...s.adminNotes, mode: "append" },
                      }))
                    }
                  />
                  Append to existing
                </label>
              </div>
              <Textarea
                rows={3}
                value={state.adminNotes.value}
                onChange={(e) =>
                  setState((s) => ({
                    ...s,
                    adminNotes: { ...s.adminNotes, value: e.target.value },
                  }))
                }
                placeholder="e.g. Confirmed by phone 2026-05-07"
              />
            </div>
          </Toggleable>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Applying…" : `Apply to ${ids.length}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Field primitives ---------- */

function Toggleable({
  label,
  on,
  onToggle,
  children,
}: {
  label: string;
  on: boolean;
  onToggle: (on: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border p-3 transition-colors",
        on ? "bg-card" : "bg-muted/30",
      )}
    >
      <label className="flex items-center gap-2.5 cursor-pointer select-none">
        <Checkbox
          checked={on}
          onCheckedChange={(v) => onToggle(v === true)}
        />
        <span className="text-sm font-medium">{label}</span>
      </label>
      {on && <div className="mt-3">{children}</div>}
    </div>
  );
}

function BoolPicker({
  value,
  onChange,
  labelTrue,
  labelFalse,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  labelTrue: string;
  labelFalse: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Button
        type="button"
        variant={value ? "default" : "outline"}
        onClick={() => onChange(true)}
        size="sm"
      >
        {labelTrue}
      </Button>
      <Button
        type="button"
        variant={!value ? "default" : "outline"}
        onClick={() => onChange(false)}
        size="sm"
      >
        {labelFalse}
      </Button>
    </div>
  );
}


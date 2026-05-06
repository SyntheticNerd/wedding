"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/lib/convex";
import type { Doc } from "@/lib/convex";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { AuditLog } from "./audit-log";

type Mode = "create" | "edit";

interface Props {
  mode: Mode;
  initial?: Doc<"guests">;
}

type FormState = {
  firstName: string;
  lastName: string;
  aliases: string;
  phoneRaw: string;
  email: string;
  side: "bride" | "groom" | "both";
  isChild: boolean;
  rsvpStatus: "pending" | "yes" | "no";
  rsvpOffline: boolean;
  plusOneAllowed: boolean;
  plusOneName: string;
  plusOneRsvp: "yes" | "no" | "";
  dietaryNotes: string;
  noteToCouple: string;
  adminNotes: string;
  invitationId: string;
  addressLine1: string;
  addressLine2: string;
  addressCity: string;
  addressRegion: string;
  addressPostal: string;
  addressCountry: string;
};

function fromGuest(g: Doc<"guests"> | undefined): FormState {
  return {
    firstName: g?.firstName ?? "",
    lastName: g?.lastName ?? "",
    aliases: g?.aliases.join(", ") ?? "",
    phoneRaw: g?.phoneE164 ?? "",
    email: g?.email ?? "",
    side: g?.side ?? "both",
    isChild: g?.isChild ?? false,
    rsvpStatus: g?.rsvpStatus ?? "pending",
    rsvpOffline: g?.rsvpOffline ?? false,
    plusOneAllowed: g?.plusOneAllowed ?? false,
    plusOneName: g?.plusOneName ?? "",
    plusOneRsvp: g?.plusOneRsvp ?? "",
    dietaryNotes: g?.dietaryNotes ?? "",
    noteToCouple: g?.noteToCouple ?? "",
    adminNotes: g?.adminNotes ?? "",
    invitationId: g?.invitationId ?? "",
    addressLine1: g?.address?.line1 ?? "",
    addressLine2: g?.address?.line2 ?? "",
    addressCity: g?.address?.city ?? "",
    addressRegion: g?.address?.region ?? "",
    addressPostal: g?.address?.postalCode ?? "",
    addressCountry: g?.address?.country ?? "",
  };
}

export function GuestForm({ mode, initial }: Props) {
  const router = useRouter();
  const [state, setState] = useState<FormState>(fromGuest(initial));
  const [pending, startTransition] = useTransition();
  const create = useMutation(api.guests.create);
  const update = useMutation(api.guests.update);
  const softDelete = useMutation(api.guests.softDelete);

  function handleChange<K extends keyof FormState>(
    key: K,
    value: FormState[K],
  ) {
    setState((s) => ({ ...s, [key]: value }));
  }

  function buildPayload() {
    const aliases = state.aliases
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    // Address is only sent if line1 is filled — partial addresses (e.g.
    // city only) are dropped to avoid storing unusable shipping info.
    const address = state.addressLine1.trim()
      ? {
          line1: state.addressLine1.trim(),
          line2: state.addressLine2.trim() || undefined,
          city: state.addressCity.trim(),
          region: state.addressRegion.trim(),
          postalCode: state.addressPostal.trim(),
          country: state.addressCountry.trim() || "US",
        }
      : undefined;
    return {
      firstName: state.firstName.trim(),
      lastName: state.lastName.trim(),
      aliases,
      phoneRaw: state.phoneRaw.trim() || undefined,
      email: state.email.trim() || undefined,
      side: state.side,
      isChild: state.isChild,
      rsvpStatus: state.rsvpStatus,
      rsvpOffline: state.rsvpOffline,
      plusOneAllowed: state.plusOneAllowed,
      // Zero out plus-one fields when the toggle is off so a previously-set
      // RSVP doesn't ghost into the rollups.
      plusOneName: state.plusOneAllowed
        ? state.plusOneName.trim() || undefined
        : undefined,
      plusOneRsvp: state.plusOneAllowed
        ? state.plusOneRsvp === ""
          ? undefined
          : state.plusOneRsvp
        : undefined,
      dietaryNotes: state.dietaryNotes.trim() || undefined,
      noteToCouple: state.noteToCouple.trim() || undefined,
      adminNotes: state.adminNotes.trim() || undefined,
      invitationId: state.invitationId.trim() || undefined,
      address,
    };
  }

  // Soft phone validation — warns the admin if the entered phone won't
  // normalize to E.164. Returns true if OK to submit.
  function validatePhoneOrToast(): boolean {
    const raw = state.phoneRaw.trim();
    if (!raw) return true;
    // Quick sanity check: must contain at least 7 digits to be a usable number.
    const digits = raw.replace(/\D/g, "");
    if (digits.length < 7) {
      toast.error(
        "Phone doesn't look valid — needs at least 7 digits. Save anyway? Re-submit.",
        { duration: 5000 },
      );
      return false;
    }
    return true;
  }

  // Track whether the user has confirmed past a phone-validation warning
  // so we don't loop forever on a guest who genuinely has an unusual number.
  const [phoneOverride, setPhoneOverride] = useState(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!state.firstName.trim() || !state.lastName.trim()) {
      toast.error("First and last name are required");
      return;
    }
    if (!phoneOverride && !validatePhoneOrToast()) {
      setPhoneOverride(true);
      return;
    }
    startTransition(async () => {
      try {
        const payload = buildPayload();
        if (mode === "create") {
          await create(payload);
          toast.success(`Added ${state.firstName}`);
          router.push("/admin");
        } else if (initial) {
          await update({ id: initial._id, ...payload });
          toast.success("Saved");
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  function onDelete() {
    if (!initial) return;
    if (!confirm(`Delete ${initial.firstName} ${initial.lastName}?`)) return;
    startTransition(async () => {
      try {
        await softDelete({ id: initial._id });
        toast.success("Deleted");
        router.push("/admin");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Delete failed");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 max-w-3xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="First name" required>
          <Input
            value={state.firstName}
            onChange={(e) => handleChange("firstName", e.target.value)}
            required
          />
        </Field>
        <Field label="Last name" required>
          <Input
            value={state.lastName}
            onChange={(e) => handleChange("lastName", e.target.value)}
            required
          />
        </Field>
        <Field
          label="Aliases / nicknames"
          hint="Comma-separated. e.g. Liz, Beth"
        >
          <Input
            value={state.aliases}
            onChange={(e) => handleChange("aliases", e.target.value)}
          />
        </Field>
        <Field
          label="Phone"
          hint="Any format — normalized to E.164 on save"
        >
          <Input
            value={state.phoneRaw}
            onChange={(e) => handleChange("phoneRaw", e.target.value)}
            placeholder="(415) 555-1212"
          />
        </Field>
        <Field label="Email">
          <Input
            type="email"
            value={state.email}
            onChange={(e) => handleChange("email", e.target.value)}
          />
        </Field>
        <Field label="Side">
          <Select
            value={state.side}
            onValueChange={(v) =>
              handleChange("side", v as FormState["side"])
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
        </Field>
        <Field
          label="Invitation ID"
          hint="Group multi-person invitations (auto if blank)"
        >
          <Input
            value={state.invitationId}
            onChange={(e) =>
              handleChange("invitationId", e.target.value)
            }
            placeholder="auto"
          />
        </Field>
        <div className="flex items-center gap-2 pt-2 sm:pt-7">
          <Checkbox
            checked={state.isChild}
            onCheckedChange={(v) =>
              handleChange("isChild", v === true)
            }
            id="isChild"
          />
          <Label htmlFor="isChild">Child</Label>
        </div>
      </div>

      <Accordion defaultValue={["rsvp", "plus-one"]}>
        <AccordionItem value="rsvp">
          <AccordionTrigger>RSVP</AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Status">
                <Select
                  value={state.rsvpStatus}
                  onValueChange={(v) =>
                    handleChange(
                      "rsvpStatus",
                      v as FormState["rsvpStatus"],
                    )
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
              </Field>
              <div className="flex items-center gap-2 pt-2 sm:pt-7">
                <Checkbox
                  checked={state.rsvpOffline}
                  onCheckedChange={(v) =>
                    handleChange("rsvpOffline", v === true)
                  }
                  id="offline"
                />
                <Label htmlFor="offline">
                  RSVP&apos;d offline (won&apos;t use the form)
                </Label>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="plus-one">
          <AccordionTrigger>Plus-one</AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={state.plusOneAllowed}
                onCheckedChange={(v) =>
                  handleChange("plusOneAllowed", v === true)
                }
                id="po-allowed"
              />
              <Label htmlFor="po-allowed">Plus-one allowed</Label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Plus-one name">
                <Input
                  value={state.plusOneName}
                  onChange={(e) =>
                    handleChange("plusOneName", e.target.value)
                  }
                  disabled={!state.plusOneAllowed}
                />
              </Field>
              <Field label="Plus-one RSVP">
                <Select
                  value={state.plusOneRsvp || "unset"}
                  onValueChange={(v) =>
                    handleChange(
                      "plusOneRsvp",
                      v === "unset"
                        ? ""
                        : (v as "yes" | "no"),
                    )
                  }
                  disabled={!state.plusOneAllowed}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unset">— not set —</SelectItem>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="address">
          <AccordionTrigger>Address (optional)</AccordionTrigger>
          <AccordionContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <Field label="Line 1" className="sm:col-span-2">
              <Input
                value={state.addressLine1}
                onChange={(e) =>
                  handleChange("addressLine1", e.target.value)
                }
              />
            </Field>
            <Field label="Line 2" className="sm:col-span-2">
              <Input
                value={state.addressLine2}
                onChange={(e) =>
                  handleChange("addressLine2", e.target.value)
                }
              />
            </Field>
            <Field label="City">
              <Input
                value={state.addressCity}
                onChange={(e) =>
                  handleChange("addressCity", e.target.value)
                }
              />
            </Field>
            <Field label="State / region">
              <Input
                value={state.addressRegion}
                onChange={(e) =>
                  handleChange("addressRegion", e.target.value)
                }
              />
            </Field>
            <Field label="Postal code">
              <Input
                value={state.addressPostal}
                onChange={(e) =>
                  handleChange("addressPostal", e.target.value)
                }
              />
            </Field>
            <Field label="Country">
              <Input
                value={state.addressCountry}
                onChange={(e) =>
                  handleChange("addressCountry", e.target.value)
                }
                placeholder="US"
              />
            </Field>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="notes">
          <AccordionTrigger>Notes</AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            <Field label="Dietary notes / allergies">
              <Textarea
                rows={2}
                value={state.dietaryNotes}
                onChange={(e) =>
                  handleChange("dietaryNotes", e.target.value)
                }
              />
            </Field>
            <Field label="Note to couple (from guest)">
              <Textarea
                rows={2}
                value={state.noteToCouple}
                onChange={(e) =>
                  handleChange("noteToCouple", e.target.value)
                }
              />
            </Field>
            <Field label="Admin notes (private)">
              <Textarea
                rows={2}
                value={state.adminNotes}
                onChange={(e) =>
                  handleChange("adminNotes", e.target.value)
                }
              />
            </Field>
          </AccordionContent>
        </AccordionItem>
        {mode === "edit" && initial && (
          <AccordionItem value="history">
            <AccordionTrigger>History</AccordionTrigger>
            <AccordionContent className="pt-2">
              <AuditLog guestId={initial._id} />
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>

      {/* Sticky on mobile so Save is always one tap away from any field;
          static at sm+ to preserve desktop reading rhythm. */}
      <div className="sticky bottom-0 -mx-6 sm:mx-0 px-6 sm:px-0 py-3 sm:py-4 bg-background/95 sm:bg-transparent backdrop-blur sm:backdrop-blur-none border-t border-border flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {mode === "create" ? "Add guest" : "Save changes"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={pending}
          >
            Cancel
          </Button>
        </div>
        {mode === "edit" && (
          <Button
            type="button"
            variant="destructive"
            onClick={onDelete}
            disabled={pending}
          >
            Delete
          </Button>
        )}
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  hint,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label className="text-xs uppercase tracking-widest text-muted-foreground">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <div className="mt-1.5">{children}</div>
      {hint && (
        <p className="text-xs text-muted-foreground mt-1">{hint}</p>
      )}
    </div>
  );
}

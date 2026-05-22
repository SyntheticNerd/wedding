"use client";

import { useState } from "react";
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Keying by registryId (or "new") forces the body to remount with
          fresh useState whenever the dialog target changes — sidesteps the
          "setState in useEffect" pattern flagged by react-hooks rules. */}
      {open && (
        <RegistryFormBody
          key={registryId ?? "new"}
          initial={initial ?? EMPTY}
          registryId={registryId}
          onDone={() => onOpenChange(false)}
        />
      )}
    </Dialog>
  );
}

function RegistryFormBody({
  initial,
  registryId,
  onDone,
}: {
  initial: RegistryFormValues;
  registryId?: Id<"registries">;
  onDone: () => void;
}) {
  const [values, setValues] = useState<RegistryFormValues>(initial);
  const add = useMutation(api.registries.add);
  const update = useMutation(api.registries.update);
  const [saving, setSaving] = useState(false);

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
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
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

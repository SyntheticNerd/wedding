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
                setValues((s) => ({ ...s, registryId: v ?? "" }))
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

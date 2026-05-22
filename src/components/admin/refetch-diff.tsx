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

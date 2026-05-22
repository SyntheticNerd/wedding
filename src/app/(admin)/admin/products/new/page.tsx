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

"use client";

import { useState, useDeferredValue, useMemo } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/lib/convex";
import { type Id } from "../../../convex/_generated/dataModel";
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
    <Select value={value} onValueChange={(v) => onChange(v ?? "all")}>
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

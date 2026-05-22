"use client";

import { useMemo, useState } from "react";
import { usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@/lib/convex";
import { type Id } from "../../../convex/_generated/dataModel";
import { RegistryCard } from "./registry-card";
import { Button } from "@/components/ui/button";

type PriceBucket = "under_50" | "50_100" | "100_250" | "250_plus";
type Sort = "featured" | "price_asc" | "price_desc" | "recent";

const SORT_LABELS: Record<Sort, string> = {
  featured: "Featured",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
  recent: "Recently added",
};

const PRICE_LABELS: Record<PriceBucket, string> = {
  under_50: "Under $50",
  "50_100": "$50–100",
  "100_250": "$100–250",
  "250_plus": "$250+",
};

export function RegistryGrid() {
  const registries = useQuery(api.registries.listPublic);
  const totals = useQuery(api.registryProducts.totalsPublic);

  const [selectedRegistries, setSelectedRegistries] = useState<
    Set<Id<"registries">>
  >(new Set());
  const [priceBucket, setPriceBucket] = useState<PriceBucket | null>(null);
  const [hideClaimed, setHideClaimed] = useState(false);
  const [sort, setSort] = useState<Sort>("featured");

  const { results, status, loadMore } = usePaginatedQuery(
    api.registryProducts.listPublic,
    {
      registryIds:
        selectedRegistries.size > 0
          ? Array.from(selectedRegistries)
          : undefined,
      priceBucket: priceBucket ?? undefined,
      hideClaimed: hideClaimed || undefined,
      sort,
    },
    { initialNumItems: 24 },
  );

  const registryMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of registries ?? []) m.set(r._id, r.name);
    return m;
  }, [registries]);

  const filtersActive =
    selectedRegistries.size > 0 ||
    priceBucket !== null ||
    hideClaimed ||
    sort !== "featured";

  function reset() {
    setSelectedRegistries(new Set());
    setPriceBucket(null);
    setHideClaimed(false);
    setSort("featured");
  }

  function toggleRegistry(id: Id<"registries">) {
    setSelectedRegistries((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 bg-cream/95 backdrop-blur py-3 border-b border-border">
        <div className="flex flex-wrap gap-2 items-center">
          {(registries ?? []).map((r) => {
            const active = selectedRegistries.has(r._id);
            return (
              <button
                key={r._id}
                type="button"
                onClick={() => toggleRegistry(r._id)}
                className={`text-xs uppercase tracking-widest px-3 py-1 rounded-full border ${
                  active
                    ? "bg-foreground text-background border-foreground"
                    : "bg-transparent border-border hover:bg-muted"
                }`}
              >
                {r.name}
              </button>
            );
          })}

          <span className="mx-2 h-4 w-px bg-border" />

          {(Object.keys(PRICE_LABELS) as PriceBucket[]).map((bucket) => {
            const active = priceBucket === bucket;
            return (
              <button
                key={bucket}
                type="button"
                onClick={() =>
                  setPriceBucket((cur) => (cur === bucket ? null : bucket))
                }
                className={`text-xs uppercase tracking-widest px-3 py-1 rounded-full border ${
                  active
                    ? "bg-foreground text-background border-foreground"
                    : "bg-transparent border-border hover:bg-muted"
                }`}
              >
                {PRICE_LABELS[bucket]}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setHideClaimed((v) => !v)}
            className={`text-xs uppercase tracking-widest px-3 py-1 rounded-full border ${
              hideClaimed
                ? "bg-foreground text-background border-foreground"
                : "bg-transparent border-border hover:bg-muted"
            }`}
          >
            Hide claimed
          </button>

          <span className="ml-auto flex items-center gap-2">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="text-xs uppercase tracking-widest bg-transparent border border-border rounded-full px-3 py-1"
            >
              {(Object.keys(SORT_LABELS) as Sort[]).map((s) => (
                <option key={s} value={s}>
                  {SORT_LABELS[s]}
                </option>
              ))}
            </select>
            {filtersActive && (
              <Button variant="ghost" size="sm" onClick={reset}>
                Reset
              </Button>
            )}
          </span>
        </div>
        {totals && (
          <p className="text-xs text-muted-foreground mt-2">
            Showing {results.length} of {totals.total}
          </p>
        )}
      </div>

      {results.length === 0 && status !== "LoadingFirstPage" ? (
        <p className="text-sm text-muted-foreground text-center py-12">
          Nothing matches those filters.{" "}
          {filtersActive && (
            <button onClick={reset} className="underline">
              Reset
            </button>
          )}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {results.map((p) => (
            <RegistryCard
              key={p._id}
              product={p}
              registryName={registryMap.get(p.registryId) ?? ""}
            />
          ))}
        </div>
      )}

      {status === "CanLoadMore" && (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={() => loadMore(24)}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}

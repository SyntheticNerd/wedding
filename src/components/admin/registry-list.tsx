"use client";

import { useState, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/lib/convex";
import { Button } from "@/components/ui/button";
import { SortableList } from "./sortable-list";
import { RegistryRow } from "./registry-row";
import { RegistryFormDialog, type RegistryFormValues } from "./registry-form";
import { type Doc, type Id } from "../../../convex/_generated/dataModel";

export function RegistryList() {
  const registries = useQuery(api.registries.listAdmin);
  const productCounts = useQuery(api.registryProducts.countsByRegistry);
  const reorder = useMutation(api.registries.reorder);

  const [editing, setEditing] = useState<Doc<"registries"> | null>(null);
  const [creating, setCreating] = useState(false);

  const countsMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const { registryId, count } of productCounts ?? []) {
      m.set(registryId, count);
    }
    return m;
  }, [productCounts]);

  async function handleReorder(orderedIds: string[]) {
    try {
      await reorder({ orderedIds: orderedIds as Id<"registries">[] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reorder failed");
    }
  }

  if (registries === undefined) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>Add registry</Button>
      </div>

      {registries.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No registries yet. Add one to start curating picks.
        </p>
      ) : (
        <div className="rounded-md border border-border bg-card">
          <SortableList
            items={registries}
            onReorder={handleReorder}
            renderItem={(r) => (
              <RegistryRow
                registry={r}
                productCount={countsMap.get(r._id) ?? 0}
                onEdit={() => setEditing(r)}
              />
            )}
          />
        </div>
      )}

      <RegistryFormDialog open={creating} onOpenChange={setCreating} />

      <RegistryFormDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        registryId={editing?._id}
        initial={
          editing
            ? ({
                name: editing.name,
                url: editing.url,
                logoUrl: editing.logoUrl ?? "",
                blurb: editing.blurb ?? "",
                hidden: editing.hidden,
              } satisfies RegistryFormValues)
            : undefined
        }
      />
    </div>
  );
}

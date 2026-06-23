"use client";

import Image from "next/image";
import { useMutation } from "convex/react";
import { Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/convex";
import { type Doc } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";

export function RegistryRow({
  registry,
  productCount,
  onEdit,
}: {
  registry: Doc<"registries">;
  productCount: number;
  onEdit: () => void;
}) {
  const setHidden = useMutation(api.registries.setHidden);
  const softDelete = useMutation(api.registries.softDelete);
  const { confirm, confirmDialog } = useConfirm();

  async function toggleHidden() {
    try {
      await setHidden({ id: registry._id, hidden: !registry.hidden });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  async function remove() {
    const ok = await confirm({
      title: `Delete "${registry.name}"?`,
      description:
        productCount > 0
          ? `It has ${productCount} product(s). They will stop rendering publicly until the registry is restored or the products are reassigned.`
          : undefined,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await softDelete({ id: registry._id });
      toast.success("Deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <div className="flex items-center gap-3 px-3 py-3">
      {confirmDialog}
      <div className="size-10 flex items-center justify-center bg-muted rounded">
        {registry.logoUrl ? (
          <Image
            src={registry.logoUrl}
            alt=""
            width={40}
            height={40}
            unoptimized
            className="object-contain w-full h-full"
          />
        ) : (
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            {registry.name.slice(0, 2)}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{registry.name}</div>
        <div className="text-xs text-muted-foreground truncate">
          {registry.url}
        </div>
      </div>
      <div className="text-xs text-muted-foreground tabular-nums">
        {productCount} item{productCount === 1 ? "" : "s"}
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleHidden}
        aria-label={registry.hidden ? "Unhide" : "Hide"}
      >
        {registry.hidden ? (
          <EyeOff className="size-4" />
        ) : (
          <Eye className="size-4" />
        )}
      </Button>
      <Button variant="ghost" size="sm" onClick={onEdit} aria-label="Edit">
        <Pencil className="size-4" />
      </Button>
      <Button variant="ghost" size="sm" onClick={remove} aria-label="Delete">
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}

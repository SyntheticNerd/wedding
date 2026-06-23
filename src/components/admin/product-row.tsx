"use client";

import Link from "next/link";
import Image from "next/image";
import { useMutation } from "convex/react";
import { Eye, EyeOff, Pencil, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/convex";
import { type Doc } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useConfirm } from "@/components/ui/confirm-dialog";

export function ProductRow({
  product,
  registryName,
}: {
  product: Doc<"registryProducts">;
  registryName: string;
}) {
  const setHidden = useMutation(api.registryProducts.setHidden);
  const setClaimed = useMutation(api.registryProducts.setClaimed);
  const softDelete = useMutation(api.registryProducts.softDelete);
  const { confirm, confirmDialog } = useConfirm();

  async function toggleHidden() {
    try {
      await setHidden({ id: product._id, hidden: !product.hidden });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }
  async function toggleClaimed() {
    try {
      await setClaimed({
        id: product._id,
        claimed: product.claimedAt === undefined,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }
  async function remove() {
    const ok = await confirm({
      title: `Delete "${product.name}"?`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await softDelete({ id: product._id });
      toast.success("Deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="flex items-center gap-3 px-3 py-3">
      {confirmDialog}
      <div className="size-12 flex items-center justify-center bg-muted rounded overflow-hidden">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt=""
            width={48}
            height={48}
            unoptimized
            className="object-cover w-full h-full"
          />
        ) : null}
      </div>
      <div className="flex-1 min-w-0">
        <Link
          href={`/admin/products/${product._id}`}
          className="font-medium truncate hover:underline block"
        >
          {product.name}
        </Link>
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <span>${(product.priceCents / 100).toFixed(2)}</span>
          <span>·</span>
          <span>{registryName}</span>
          {product.claimedAt !== undefined && (
            <Badge variant="secondary" className="ml-1">
              Claimed
            </Badge>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleClaimed}
        aria-label={
          product.claimedAt !== undefined
            ? "Mark as not claimed"
            : "Mark as claimed"
        }
      >
        {product.claimedAt !== undefined ? (
          <X className="size-4" />
        ) : (
          <Check className="size-4" />
        )}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleHidden}
        aria-label={product.hidden ? "Unhide" : "Hide"}
      >
        {product.hidden ? (
          <EyeOff className="size-4" />
        ) : (
          <Eye className="size-4" />
        )}
      </Button>
      <Link
        href={`/admin/products/${product._id}`}
        aria-label="Edit"
        className="inline-flex items-center justify-center size-9 rounded-md hover:bg-muted"
      >
        <Pencil className="size-4" />
      </Link>
      <Button variant="ghost" size="sm" onClick={remove} aria-label="Delete">
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}

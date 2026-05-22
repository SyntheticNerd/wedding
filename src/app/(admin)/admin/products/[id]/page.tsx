"use client";

import Link from "next/link";
import { use } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/lib/convex";
import { ProductForm } from "@/components/admin/product-form";
import { RefetchDiff } from "@/components/admin/refetch-diff";
import { Button } from "@/components/ui/button";
import { type Id } from "../../../../../../convex/_generated/dataModel";

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const productId = id as Id<"registryProducts">;
  const product = useQuery(api.registryProducts.get, { id: productId });
  const setClaimed = useMutation(api.registryProducts.setClaimed);

  if (product === undefined) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (product === null) {
    return <p className="text-sm text-muted-foreground">Not found.</p>;
  }

  async function toggleClaimed() {
    try {
      await setClaimed({
        id: productId,
        claimed: product!.claimedAt === undefined,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  const isClaimed = product.claimedAt !== undefined;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="font-heading text-3xl">Edit product</h1>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={toggleClaimed}>
            {isClaimed ? "Mark as available" : "Mark as claimed"}
          </Button>
          <Link
            href={product.productUrl}
            target="_blank"
            rel="noopener"
            className="text-sm underline"
          >
            Preview as guest →
          </Link>
        </div>
      </div>

      <ProductForm
        product={product}
        initial={{
          registryId: product.registryId,
          name: product.name,
          priceDollars: (product.priceCents / 100).toString(),
          imageUrl: product.imageUrl,
          productUrl: product.productUrl,
          hidden: product.hidden,
        }}
      />

      <RefetchDiff product={product} />
    </div>
  );
}

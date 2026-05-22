"use client";

import { use } from "react";
import { useQuery } from "convex/react";
import { api } from "@/lib/convex";
import { ProductForm } from "@/components/admin/product-form";
import { type Id } from "../../../../../../convex/_generated/dataModel";

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const productId = id as Id<"registryProducts">;
  const product = useQuery(api.registryProducts.get, { id: productId });

  if (product === undefined) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (product === null) {
    return <p className="text-sm text-muted-foreground">Not found.</p>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="font-heading text-3xl">Edit product</h1>
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
    </div>
  );
}

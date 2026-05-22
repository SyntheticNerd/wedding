"use client";

import { ProductForm, EMPTY_PRODUCT } from "@/components/admin/product-form";

export default function NewProductPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="font-heading text-3xl">Add product</h1>
      <ProductForm initial={EMPTY_PRODUCT} />
    </div>
  );
}

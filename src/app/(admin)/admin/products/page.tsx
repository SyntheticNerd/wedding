import { ProductList } from "@/components/admin/product-list";

export default function ProductsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl">Curated picks</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Hand-picked items pulled from the registries above. Shown on the
          public Registry page.
        </p>
      </div>
      <ProductList />
    </div>
  );
}

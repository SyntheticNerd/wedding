import Image from "next/image";
import { type Doc } from "../../../convex/_generated/dataModel";

export function RegistryCard({
  product,
  registryName,
}: {
  product: Doc<"registryProducts">;
  registryName: string;
}) {
  const claimed = product.claimedAt !== undefined;
  return (
    <a
      href={product.productUrl}
      target="_blank"
      rel="noopener"
      className={`block group rounded-md overflow-hidden border border-border bg-card hover:shadow-sm transition ${
        claimed ? "opacity-60" : ""
      }`}
    >
      <div className="relative aspect-square bg-muted">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="(min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw"
            unoptimized
            className="object-cover"
          />
        ) : null}
        {claimed && (
          <span className="absolute top-2 left-2 text-[10px] uppercase tracking-widest bg-charcoal text-cream px-2 py-1 rounded">
            Already taken
          </span>
        )}
      </div>
      <div className="p-3 space-y-1">
        <div className="text-sm leading-snug line-clamp-2">{product.name}</div>
        <div className="text-sm font-medium">
          ${(product.priceCents / 100).toFixed(0)}
        </div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {registryName}
        </div>
      </div>
    </a>
  );
}

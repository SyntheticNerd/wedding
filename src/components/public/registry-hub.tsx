"use client";

import Image from "next/image";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/lib/convex";

export function RegistryHub() {
  const registries = useQuery(api.registries.listPublic);
  if (!registries || registries.length === 0) return null;

  return (
    <section className="space-y-4">
      <h3 className="font-heading text-2xl text-center">
        Where we&apos;re registered
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {registries.map((r) => (
          <Link
            key={r._id}
            href={r.url}
            target="_blank"
            rel="noopener"
            className="aspect-[2/1] rounded-md border border-border bg-card flex items-center justify-center p-4 hover:shadow-sm transition"
          >
            {r.logoUrl ? (
              <Image
                src={r.logoUrl}
                alt={r.name}
                width={120}
                height={48}
                unoptimized
                className="object-contain max-h-full"
              />
            ) : (
              <span className="font-heading text-lg">{r.name}</span>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}

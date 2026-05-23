"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy, Check } from "lucide-react";
import { type Hotel } from "@/lib/travel";

export function HotelCard({ hotel }: { hotel: Hotel }) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    if (!hotel.code) return;
    try {
      await navigator.clipboard.writeText(hotel.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can fail in older browsers / insecure contexts.
      // Silent — guest can still read and type the code by hand.
    }
  }

  const nameNode = hotel.bookingUrl ? (
    <Link
      href={hotel.bookingUrl}
      target="_blank"
      rel="noopener"
      className="font-medium hover:underline"
    >
      {hotel.name}
    </Link>
  ) : (
    <span className="font-medium">{hotel.name}</span>
  );

  return (
    <div className="bg-card border border-border rounded-md p-5 space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">{nameNode}</div>
        {hotel.priceTier && (
          <span className="text-xs text-muted-foreground tabular-nums shrink-0">
            {hotel.priceTier}
          </span>
        )}
      </div>

      {hotel.distance && (
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          {hotel.distance}
        </p>
      )}

      {hotel.code && (
        <button
          type="button"
          onClick={copyCode}
          className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-muted hover:bg-muted/70 transition"
          aria-label={`Copy room-block code ${hotel.code}`}
        >
          {copied ? (
            <Check className="size-3" />
          ) : (
            <Copy className="size-3" />
          )}
          <span className="font-mono">{hotel.code}</span>
        </button>
      )}

      {hotel.notes && (
        <p className="text-sm italic text-muted-foreground">{hotel.notes}</p>
      )}

      {hotel.bookingUrl && (
        <Link
          href={hotel.bookingUrl}
          target="_blank"
          rel="noopener"
          className="inline-block text-xs tracking-widest uppercase border border-foreground rounded-full px-4 py-1.5 hover:bg-foreground hover:text-background transition"
        >
          Book →
        </Link>
      )}
    </div>
  );
}

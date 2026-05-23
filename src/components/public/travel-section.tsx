"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/lib/convex";
import { parseHotels } from "@/lib/travel";
import { HotelCard } from "./hotel-card";

export function TravelSection() {
  const settings = useQuery(api.settings.publicSettings);

  const hotels = useMemo(() => {
    if (!settings) return [];
    const all = parseHotels(settings["travel.hotels"]);
    return all.filter((h) => !h.hidden);
  }, [settings]);

  if (settings === undefined) return null;

  const gettingHere =
    typeof settings["travel.gettingHere"] === "string"
      ? (settings["travel.gettingHere"] as string).trim()
      : "";
  const practical =
    typeof settings["travel.practical"] === "string"
      ? (settings["travel.practical"] as string).trim()
      : "";

  const hasAnything =
    hotels.length > 0 || gettingHere.length > 0 || practical.length > 0;
  if (!hasAnything) return null;

  return (
    <section className="px-6 py-16 sm:py-24 border-t border-blush/40">
      <div className="mx-auto max-w-4xl space-y-12">
        <div className="text-center space-y-2">
          <h2 className="font-heading text-4xl sm:text-5xl">Travel &amp; info</h2>
          <div className="mx-auto h-px w-12 bg-blush" />
        </div>

        {hotels.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-heading text-2xl text-center">
              Where to stay
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {hotels.map((h, i) => (
                <HotelCard key={`${h.name}-${i}`} hotel={h} />
              ))}
            </div>
          </div>
        )}

        {gettingHere && (
          <div className="space-y-3">
            <h3 className="font-heading text-2xl text-center">Getting here</h3>
            <p className="whitespace-pre-line text-sm sm:text-base max-w-prose mx-auto">
              {gettingHere}
            </p>
          </div>
        )}

        {practical && (
          <div className="space-y-3">
            <h3 className="font-heading text-2xl text-center">Good to know</h3>
            <p className="whitespace-pre-line text-sm sm:text-base max-w-prose mx-auto">
              {practical}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

"use client";

import { useState, useMemo, useTransition } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/lib/convex";
import { parseHotels, type Hotel } from "@/lib/travel";
import { SortableList } from "./sortable-list";
import { HotelRow, type HotelDraft } from "./hotel-row";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function TravelEditor() {
  const settings = useQuery(api.settings.all);
  const setSetting = useMutation(api.settings.set);
  const [pending, startTransition] = useTransition();

  if (settings === undefined) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  return (
    <Body
      key="loaded"
      settings={settings}
      pending={pending}
      onSave={(next) => {
        startTransition(async () => {
          try {
            await Promise.all([
              setSetting({
                key: "travel.hotels",
                value: next.hotels.length > 0 ? next.hotels : null,
              }),
              setSetting({
                key: "travel.gettingHere",
                value: next.gettingHere.trim() || null,
              }),
              setSetting({
                key: "travel.practical",
                value: next.practical.trim() || null,
              }),
            ]);
            toast.success("Saved");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Save failed");
          }
        });
      }}
    />
  );
}

function Body({
  settings,
  pending,
  onSave,
}: {
  settings: Record<string, unknown>;
  pending: boolean;
  onSave: (next: {
    hotels: Hotel[];
    gettingHere: string;
    practical: string;
  }) => void;
}) {
  const initialDrafts = useMemo<HotelDraft[]>(
    () =>
      parseHotels(settings["travel.hotels"]).map((h) => ({
        _id: crypto.randomUUID(),
        name: h.name,
        bookingUrl: h.bookingUrl ?? "",
        distance: h.distance ?? "",
        priceTier: h.priceTier ?? "",
        code: h.code ?? "",
        notes: h.notes ?? "",
        hidden: h.hidden === true,
      })),
    [settings],
  );

  const [drafts, setDrafts] = useState<HotelDraft[]>(initialDrafts);
  const [gettingHere, setGettingHere] = useState<string>(
    typeof settings["travel.gettingHere"] === "string"
      ? (settings["travel.gettingHere"] as string)
      : "",
  );
  const [practical, setPractical] = useState<string>(
    typeof settings["travel.practical"] === "string"
      ? (settings["travel.practical"] as string)
      : "",
  );

  function addHotel() {
    setDrafts((arr) => [
      ...arr,
      {
        _id: crypto.randomUUID(),
        name: "",
        bookingUrl: "",
        distance: "",
        priceTier: "",
        code: "",
        notes: "",
        hidden: false,
      },
    ]);
  }

  function updateHotel(index: number, next: HotelDraft) {
    setDrafts((arr) => arr.map((d, i) => (i === index ? next : d)));
  }

  function deleteHotel(id: string) {
    setDrafts((arr) => arr.filter((d) => d._id !== id));
  }

  function handleReorder(orderedIds: string[]) {
    const byId = new Map(drafts.map((d) => [d._id, d]));
    const next: HotelDraft[] = [];
    for (const id of orderedIds) {
      const d = byId.get(id);
      if (d) next.push(d);
    }
    for (const d of drafts) if (!orderedIds.includes(d._id)) next.push(d);
    setDrafts(next);
  }

  function save() {
    const cleaned: Hotel[] = drafts
      .filter((d) => d.name.trim().length > 0)
      .map((d) => {
        const h: Hotel = { name: d.name.trim() };
        if (d.bookingUrl.trim()) h.bookingUrl = d.bookingUrl.trim();
        if (d.distance.trim()) h.distance = d.distance.trim();
        if (d.priceTier) h.priceTier = d.priceTier;
        if (d.code.trim()) h.code = d.code.trim();
        if (d.notes.trim()) h.notes = d.notes.trim();
        if (d.hidden) h.hidden = true;
        return h;
      });
    onSave({ hotels: cleaned, gettingHere, practical });
  }

  return (
    <div className="space-y-10 max-w-3xl">
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-xl">Where to stay</h2>
          <Button variant="secondary" size="sm" onClick={addHotel}>
            Add hotel
          </Button>
        </div>
        {drafts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hotels yet. Add one with the button above.
          </p>
        ) : (
          <div className="rounded-md border border-border bg-card">
            <SortableList
              items={drafts}
              onReorder={handleReorder}
              renderItem={(d) => {
                const index = drafts.findIndex((x) => x._id === d._id);
                return (
                  <HotelRow
                    hotel={d}
                    onChange={(next) => updateHotel(index, next)}
                    onDelete={() => deleteHotel(d._id)}
                  />
                );
              }}
            />
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl">Getting here</h2>
        <Label className="text-xs uppercase tracking-widest text-muted-foreground">
          Free-form text. Paragraph breaks are preserved on the public page.
        </Label>
        <Textarea
          value={gettingHere}
          onChange={(e) => setGettingHere(e.target.value)}
          placeholder="Nearest airport, driving directions, parking…"
          rows={6}
        />
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl">Good to know</h2>
        <Label className="text-xs uppercase tracking-widest text-muted-foreground">
          Dress code, weather, day-of schedule.
        </Label>
        <Textarea
          value={practical}
          onChange={(e) => setPractical(e.target.value)}
          placeholder="Dress code, weather, schedule…"
          rows={6}
        />
      </section>

      <div className="pt-4 border-t border-border">
        <Button onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

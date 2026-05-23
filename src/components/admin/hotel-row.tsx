"use client";

import { type PriceTier } from "@/lib/travel";
import { Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

/**
 * Local-only shape — adds the transient `_id` SortableList needs.
 * Persisted JSON drops `_id` (see travel-editor.tsx).
 */
export type HotelDraft = {
  _id: string;
  name: string;
  bookingUrl: string;
  distance: string;
  priceTier: PriceTier | "";
  code: string;
  notes: string;
  hidden: boolean;
};

const TIER_OPTIONS: PriceTier[] = ["$", "$$", "$$$"];

export function HotelRow({
  hotel,
  onChange,
  onDelete,
}: {
  hotel: HotelDraft;
  onChange: (next: HotelDraft) => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-3 px-3 py-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Name *">
          <Input
            value={hotel.name}
            onChange={(e) => onChange({ ...hotel, name: e.target.value })}
            placeholder="Marriott Riverside"
          />
        </Field>
        <Field label="Booking URL">
          <Input
            value={hotel.bookingUrl}
            onChange={(e) => onChange({ ...hotel, bookingUrl: e.target.value })}
            placeholder="https://..."
          />
        </Field>
        <Field label="Distance">
          <Input
            value={hotel.distance}
            onChange={(e) => onChange({ ...hotel, distance: e.target.value })}
            placeholder="0.5 mi from venue"
          />
        </Field>
        <Field label="Price tier">
          <div className="flex gap-1">
            {TIER_OPTIONS.map((t) => {
              const active = hotel.priceTier === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() =>
                    onChange({
                      ...hotel,
                      priceTier: active ? "" : t,
                    })
                  }
                  className={`text-xs px-3 py-1.5 rounded-md border tabular-nums ${
                    active
                      ? "bg-foreground text-background border-foreground"
                      : "bg-transparent border-border hover:bg-muted"
                  }`}
                  aria-pressed={active}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="Room-block code">
          <Input
            value={hotel.code}
            onChange={(e) => onChange({ ...hotel, code: e.target.value })}
            placeholder="SMITH-JONES-2026"
          />
        </Field>
        <Field label="Notes (one line)">
          <Input
            value={hotel.notes}
            onChange={(e) => onChange({ ...hotel, notes: e.target.value })}
            placeholder="Ask for the wedding block"
          />
        </Field>
      </div>

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={hotel.hidden}
            onCheckedChange={(v) =>
              onChange({ ...hotel, hidden: v === true })
            }
          />
          Hide from public page
        </label>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          aria-label="Delete hotel"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs uppercase tracking-widest text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/lib/convex";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

/**
 * Edit-state pattern: each field is `null` until the user touches it, at
 * which point local state wins. This avoids the "setState in useEffect"
 * cascading-render anti-pattern flagged by react-hooks/set-state-in-effect.
 */
type Edited<T> = T | null;

export default function SettingsPage() {
  const settings = useQuery(api.settings.all);
  const me = useQuery(api.adminProfiles.me);
  const setSetting = useMutation(api.settings.set);
  const setNotifications = useMutation(
    api.adminProfiles.setNotificationsEnabled,
  );
  const [pending, startTransition] = useTransition();

  const [coupleNamesEdit, setCoupleNamesEdit] =
    useState<Edited<string>>(null);
  const [weddingDateEdit, setWeddingDateEdit] =
    useState<Edited<string>>(null);
  const [lockedAtEdit, setLockedAtEdit] =
    useState<Edited<string>>(null);
  const [venueCapacityEdit, setVenueCapacityEdit] =
    useState<Edited<string>>(null);
  const [weddingBudgetEdit, setWeddingBudgetEdit] =
    useState<Edited<string>>(null);
  const [notificationsEdit, setNotificationsEdit] =
    useState<Edited<boolean>>(null);

  const coupleNames =
    coupleNamesEdit ?? (settings?.coupleNames as string | null) ?? "";
  const weddingDate =
    weddingDateEdit ?? (settings?.weddingDate as string | null) ?? "";
  const lockedAt =
    lockedAtEdit ?? (settings?.lockedAt as string | null) ?? "";
  const venueCapacity =
    venueCapacityEdit ??
    (settings?.venueCapacity != null
      ? String(settings.venueCapacity)
      : "");
  const weddingBudget =
    weddingBudgetEdit ??
    (settings?.weddingBudget != null
      ? String(settings.weddingBudget)
      : "");
  const notificationsOn =
    notificationsEdit ??
    me?.profile?.emailNotificationsEnabled ??
    true;

  function save() {
    startTransition(async () => {
      try {
        const capacityRaw = venueCapacity.trim();
        const capacityParsed = capacityRaw
          ? Number.parseInt(capacityRaw, 10)
          : null;
        // Reject negatives + non-finite values silently — UI also has min=0.
        const capacityNumber =
          capacityParsed != null &&
          Number.isFinite(capacityParsed) &&
          capacityParsed >= 0
            ? capacityParsed
            : null;
        if (capacityRaw && capacityNumber === null) {
          toast.error("Venue capacity must be a non-negative whole number");
          return;
        }

        const budgetRaw = weddingBudget.trim();
        const budgetParsed = budgetRaw
          ? Number.parseInt(budgetRaw, 10)
          : null;
        const budgetNumber =
          budgetParsed != null &&
          Number.isFinite(budgetParsed) &&
          budgetParsed >= 0
            ? budgetParsed
            : null;
        if (budgetRaw && budgetNumber === null) {
          toast.error("Wedding budget must be a non-negative whole number");
          return;
        }

        await Promise.all([
          setSetting({
            key: "coupleNames",
            value: coupleNames.trim() || null,
          }),
          setSetting({
            key: "weddingDate",
            value: weddingDate.trim() || null,
          }),
          setSetting({
            key: "lockedAt",
            value: lockedAt.trim() || null,
          }),
          setSetting({
            key: "venueCapacity",
            value:
              capacityNumber != null && Number.isFinite(capacityNumber)
                ? capacityNumber
                : null,
          }),
          setSetting({
            key: "weddingBudget",
            value:
              budgetNumber != null && Number.isFinite(budgetNumber)
                ? budgetNumber
                : null,
          }),
          setNotifications({ enabled: notificationsOn }),
        ]);
        toast.success("Settings saved");
        setCoupleNamesEdit(null);
        setWeddingDateEdit(null);
        setLockedAtEdit(null);
        setVenueCapacityEdit(null);
        setWeddingBudgetEdit(null);
        setNotificationsEdit(null);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link
          href="/admin"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to guest list
        </Link>
        <h1 className="font-heading text-3xl mt-2">Settings</h1>
      </div>

      <section className="space-y-4">
        <h2 className="font-heading text-xl">Couple</h2>
        <div className="space-y-1">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">
            Couple names (display)
          </Label>
          <Input
            value={coupleNames}
            onChange={(e) => setCoupleNamesEdit(e.target.value)}
            placeholder="Andrew & Partner"
          />
          <p className="text-xs text-muted-foreground">
            Shown in the site header and emails. Defaults to the values in{" "}
            <code>src/lib/site-config.ts</code> if blank.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-xl">Dates</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
              Wedding date
            </Label>
            <Input
              type="date"
              value={weddingDate}
              onChange={(e) => setWeddingDateEdit(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
              RSVP cutoff (lock)
            </Label>
            <Input
              type="date"
              value={lockedAt}
              onChange={(e) => setLockedAtEdit(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              After this date, the public RSVP form is read-only.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-xl">Venue capacity</h2>
        <div className="space-y-1 max-w-xs">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">
            Maximum headcount
          </Label>
          <Input
            type="number"
            min={0}
            value={venueCapacity}
            onChange={(e) => setVenueCapacityEdit(e.target.value)}
            placeholder="e.g. 150"
          />
          <p className="text-xs text-muted-foreground">
            Used by the capacity bar on the guest list to flag when projected
            attendance approaches or exceeds this number.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-xl">Wedding budget</h2>
        <div className="space-y-1 max-w-xs">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">
            Total budget (USD)
          </Label>
          <Input
            type="number"
            min={0}
            value={weddingBudget}
            onChange={(e) => setWeddingBudgetEdit(e.target.value)}
            placeholder="e.g. 45000"
          />
          <p className="text-xs text-muted-foreground">
            Used by the budget bar on the vendors page. Leave blank to show
            committed spend without a target.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-xl">Your notifications</h2>
        <div className="flex items-center gap-2">
          <Checkbox
            id="notifications"
            checked={notificationsOn}
            onCheckedChange={(v) => setNotificationsEdit(v === true)}
          />
          <Label htmlFor="notifications">
            Email me when a guest RSVPs
          </Label>
        </div>
      </section>

      <div className="pt-4 border-t border-border">
        <Button onClick={save} disabled={pending}>
          Save settings
        </Button>
      </div>
    </div>
  );
}

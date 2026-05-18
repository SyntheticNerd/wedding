"use client";

import { useState, useTransition } from "react";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/convex";
import type { Doc, Id } from "@/lib/convex";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  categoryCanBundle,
  INCLUDES,
  INCLUDE_LABELS,
  PRICE_UNITS,
  PRICE_UNIT_LABELS,
  STATUSES,
  STATUS_LABELS,
} from "@/lib/vendor-categories";

type Vendor = Doc<"vendors">;

export function VendorForm({ existing }: { existing?: Vendor }) {
  const router = useRouter();
  const add = useMutation(api.vendors.add);
  const update = useMutation(api.vendors.update);
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState(existing?.name ?? "");
  const [category, setCategory] = useState(existing?.category ?? "venue");
  const [customCategory, setCustomCategory] = useState(
    existing?.customCategory ?? "",
  );
  const [status, setStatus] = useState<Vendor["status"]>(
    existing?.status ?? "considering",
  );
  const [priceTotal, setPriceTotal] = useState<string>(
    existing?.priceTotal != null ? String(existing.priceTotal) : "",
  );
  const [priceUnit, setPriceUnit] = useState<string>(
    existing?.priceUnit ?? "flat",
  );
  const [includes, setIncludes] = useState<string[]>(
    existing?.includes ?? [],
  );
  const [contactName, setContactName] = useState(existing?.contactName ?? "");
  const [phone, setPhone] = useState(existing?.phone ?? "");
  const [email, setEmail] = useState(existing?.email ?? "");
  const [website, setWebsite] = useState(existing?.website ?? "");
  const [location, setLocation] = useState(existing?.location ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [pros, setPros] = useState(existing?.pros ?? "");
  const [cons, setCons] = useState(existing?.cons ?? "");
  const [rating, setRating] = useState<string>(
    existing?.rating != null ? String(existing.rating) : "",
  );
  const [depositAmount, setDepositAmount] = useState<string>(
    existing?.depositAmount != null ? String(existing.depositAmount) : "",
  );
  const [depositPaid, setDepositPaid] = useState<boolean>(
    existing?.depositPaidAt != null,
  );
  const [finalDueAt, setFinalDueAt] = useState<string>(
    existing?.finalDueAt
      ? new Date(existing.finalDueAt).toISOString().slice(0, 10)
      : "",
  );
  const [finalPaid, setFinalPaid] = useState<boolean>(
    existing?.finalPaidAt != null,
  );

  function toggleInclude(tag: string) {
    setIncludes((cur) =>
      cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag],
    );
  }

  function changeCategory(next: string) {
    setCategory(next);
    // Clear includes when switching to a non-bundler category — keeps stored
    // data consistent with what the form actually offers.
    if (!categoryCanBundle(next)) setIncludes([]);
  }

  function save() {
    startTransition(async () => {
      try {
        const trimmedName = name.trim();
        if (!trimmedName) {
          toast.error("Name is required");
          return;
        }
        const parsedPrice = priceTotal.trim()
          ? Number.parseInt(priceTotal.trim(), 10)
          : undefined;
        if (priceTotal.trim() && !Number.isFinite(parsedPrice)) {
          toast.error("Price must be a whole number of dollars");
          return;
        }
        const parsedRating = rating.trim()
          ? Number.parseInt(rating.trim(), 10)
          : undefined;
        const parsedDeposit = depositAmount.trim()
          ? Number.parseInt(depositAmount.trim(), 10)
          : undefined;
        const parsedFinalDue = finalDueAt
          ? new Date(`${finalDueAt}T00:00:00`).getTime()
          : undefined;

        const payload = {
          name: trimmedName,
          category,
          customCategory:
            category === "other"
              ? customCategory.trim() || undefined
              : undefined,
          status,
          priceTotal: parsedPrice,
          priceUnit:
            parsedPrice != null
              ? (priceUnit as Vendor["priceUnit"])
              : undefined,
          includes,
          contactName: contactName.trim() || undefined,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          website: website.trim() || undefined,
          location: location.trim() || undefined,
          notes: notes.trim() || undefined,
          pros: pros.trim() || undefined,
          cons: cons.trim() || undefined,
          rating: parsedRating,
          depositAmount: parsedDeposit,
          // Preserve the original paid-at timestamp on edit; only stamp a
          // fresh `Date.now()` when transitioning from unpaid → paid.
          depositPaidAt: depositPaid
            ? (existing?.depositPaidAt ?? Date.now())
            : undefined,
          finalDueAt: parsedFinalDue,
          finalPaidAt: finalPaid
            ? (existing?.finalPaidAt ?? Date.now())
            : undefined,
        };

        if (existing) {
          await update({ id: existing._id, ...payload });
          toast.success("Vendor updated");
          router.push(`/admin/vendors/${existing._id}`);
        } else {
          const { id } = await add(payload);
          toast.success("Vendor added");
          router.push(`/admin/vendors/${id as Id<"vendors">}`);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Category">
          <Select
            value={category}
            onValueChange={(v) => v != null && changeCategory(v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {category === "other" && (
          <Field label="Custom category label">
            <Input
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
            />
          </Field>
        )}
        <Field label="Status">
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as Vendor["status"])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Location">
          <Input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="City, state"
          />
        </Field>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Price (USD, integer)">
          <Input
            type="number"
            min={0}
            value={priceTotal}
            onChange={(e) => setPriceTotal(e.target.value)}
          />
        </Field>
        <Field label="Price unit">
          <Select
            value={priceUnit}
            onValueChange={(v) => v != null && setPriceUnit(v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRICE_UNITS.map((u) => (
                <SelectItem key={u} value={u}>
                  {PRICE_UNIT_LABELS[u]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Rating (1–5)">
          <Input
            type="number"
            min={1}
            max={5}
            value={rating}
            onChange={(e) => setRating(e.target.value)}
          />
        </Field>
      </section>

      {categoryCanBundle(category) && (
        <section>
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">
            What it includes
          </Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {INCLUDES.map((tag) => (
              <label
                key={tag}
                className={`cursor-pointer rounded-full px-3 py-1 text-xs border transition-colors ${
                  includes.includes(tag)
                    ? "bg-[var(--accent)]/15 border-[var(--accent)] text-foreground"
                    : "bg-background border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={includes.includes(tag)}
                  onChange={() => toggleInclude(tag)}
                />
                {INCLUDE_LABELS[tag]}
              </label>
            ))}
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Contact name">
          <Input
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
          />
        </Field>
        <Field label="Phone">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="Email">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Website">
          <Input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </Field>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Deposit amount (USD)">
          <Input
            type="number"
            min={0}
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
          />
        </Field>
        <Field label="Final payment due">
          <Input
            type="date"
            value={finalDueAt}
            onChange={(e) => setFinalDueAt(e.target.value)}
          />
        </Field>
        <div className="flex items-center gap-2">
          <Checkbox
            id="deposit-paid"
            checked={depositPaid}
            onCheckedChange={(v) => setDepositPaid(v === true)}
          />
          <Label htmlFor="deposit-paid">Deposit paid</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="final-paid"
            checked={finalPaid}
            onCheckedChange={(v) => setFinalPaid(v === true)}
          />
          <Label htmlFor="final-paid">Final payment paid</Label>
        </div>
      </section>

      <section className="space-y-4">
        <Field label="Notes (markdown)">
          <Textarea
            rows={6}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything to remember…"
          />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Pros">
            <Textarea
              rows={3}
              value={pros}
              onChange={(e) => setPros(e.target.value)}
            />
          </Field>
          <Field label="Cons">
            <Textarea
              rows={3}
              value={cons}
              onChange={(e) => setCons(e.target.value)}
            />
          </Field>
        </div>
      </section>

      <div className="flex gap-2 pt-4 border-t border-border">
        <Button onClick={save} disabled={pending}>
          {existing ? "Save changes" : "Add vendor"}
        </Button>
        <Button
          variant="outline"
          onClick={() => router.back()}
          disabled={pending}
        >
          Cancel
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

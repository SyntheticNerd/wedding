"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/convex";
import type { Id } from "@/lib/convex";
import { formatUSD } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  categoryLabel,
  includeLabel,
  PRICE_UNIT_LABELS,
} from "@/lib/vendor-categories";
import { VendorForm } from "./vendor-form";
import { VendorStatusPicker } from "./vendor-status-picker";
import { AppointmentsSection } from "./appointments-section";

export function VendorDetail({ id }: { id: Id<"vendors"> }) {
  const vendor = useQuery(api.vendors.get, { id });
  const softDelete = useMutation(api.vendors.softDelete);
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  if (vendor === undefined) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (vendor === null) {
    return (
      <p className="text-sm text-muted-foreground">Vendor not found.</p>
    );
  }

  if (editing) {
    return <VendorForm existing={vendor} />;
  }

  async function onDelete() {
    if (!vendor) return;
    if (!confirm(`Delete ${vendor.name}? This is reversible.`)) return;
    try {
      await softDelete({ id });
      toast.success("Vendor deleted");
      router.push("/admin/vendors");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest">
            <Badge variant="secondary" className="text-[10px] uppercase tracking-widest bg-muted text-muted-foreground">
              {categoryLabel(vendor.category, vendor.customCategory)}
            </Badge>
            <VendorStatusPicker vendorId={vendor._id} status={vendor.status} />
          </div>
          <h1 className="font-heading text-3xl mt-2">{vendor.name}</h1>
          {vendor.location && (
            <p className="text-sm text-muted-foreground mt-1">
              {vendor.location}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button variant="destructive" size="sm" onClick={onDelete}>
            Delete
          </Button>
        </div>
      </div>

      <section className="rounded-lg border border-border bg-card p-4 space-y-2">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
          Pricing
        </h2>
        <p className="text-2xl font-heading tabular-nums">
          {vendor.priceTotal != null
            ? formatUSD(vendor.priceTotal)
            : "—"}
          {vendor.priceUnit && (
            <span className="ml-2 text-sm text-muted-foreground font-sans">
              {PRICE_UNIT_LABELS[vendor.priceUnit]}
            </span>
          )}
        </p>
        {vendor.includes.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {vendor.includes.map((t) => (
              <span
                key={t}
                className="text-[11px] bg-[var(--accent)]/10 text-[var(--accent)] px-2 py-0.5 rounded"
              >
                {includeLabel(t)}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card title="Contact">
          <DefList
            entries={[
              ["Name", vendor.contactName],
              ["Phone", vendor.phone],
              ["Email", vendor.email],
              [
                "Website",
                vendor.website ? (
                  <a
                    href={vendor.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--accent)] underline underline-offset-2"
                  >
                    {vendor.website}
                  </a>
                ) : undefined,
              ],
            ]}
          />
        </Card>
        <Card title="Payments">
          <DefList
            entries={[
              [
                "Deposit",
                vendor.depositAmount != null
                  ? `${formatUSD(vendor.depositAmount)}${
                      vendor.depositPaidAt != null ? " · paid" : ""
                    }`
                  : undefined,
              ],
              [
                "Final due",
                vendor.finalDueAt
                  ? new Date(vendor.finalDueAt).toLocaleDateString()
                  : undefined,
              ],
              ["Final paid", vendor.finalPaidAt ? "yes" : undefined],
            ]}
          />
        </Card>
      </section>

      {vendor.notes && (
        <Card title="Notes">
          <pre className="whitespace-pre-wrap wrap-anywhere font-sans text-sm text-foreground">
            {vendor.notes}
          </pre>
        </Card>
      )}

      {(vendor.pros || vendor.cons) && (
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {vendor.pros && (
            <Card title="Pros">
              <pre className="whitespace-pre-wrap wrap-anywhere font-sans text-sm">
                {vendor.pros}
              </pre>
            </Card>
          )}
          {vendor.cons && (
            <Card title="Cons">
              <pre className="whitespace-pre-wrap wrap-anywhere font-sans text-sm">
                {vendor.cons}
              </pre>
            </Card>
          )}
        </section>
      )}

      {vendor.links.length > 0 && (
        <Card title="Links">
          <ul className="space-y-1 text-sm">
            {vendor.links.map((l, i) => (
              <li key={i}>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--accent)] underline underline-offset-2 wrap-anywhere"
                >
                  {l.label || l.url}
                </a>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p>
        <Link
          href="/admin/vendors"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to vendors
        </Link>
      </p>

      <AppointmentsSection vendorId={vendor._id} vendorName={vendor.name} />
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-2">
      <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
        {title}
      </h2>
      {children}
    </div>
  );
}

function DefList({
  entries,
}: {
  entries: Array<[string, React.ReactNode]>;
}) {
  const visible = entries.filter(([, val]) => {
    if (val == null || val === false) return false;
    if (typeof val === "string") return val.trim().length > 0;
    return true;
  });
  if (visible.length === 0) {
    return <p className="text-sm text-muted-foreground">—</p>;
  }
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
      {visible.map(([k, val]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="text-foreground min-w-0 wrap-anywhere">{val}</dd>
        </div>
      ))}
    </dl>
  );
}

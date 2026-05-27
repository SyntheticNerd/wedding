"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/lib/convex";
import { type Id } from "../../../convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AppointmentFormBody } from "./appointment-form";

/**
 * Global "+ Appointment" entry point for the admin landing.
 *
 * Two states: pick a vendor, then render the existing appointment form
 * body against that vendor. The shared form body knows how to save and
 * close — we just give it a vendorId and an onDone handler.
 */
export function GlobalAppointmentDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && <Body onDone={() => onOpenChange(false)} />}
    </Dialog>
  );
}

function Body({ onDone }: { onDone: () => void }) {
  const vendors = useQuery(api.vendors.list, {});
  const [vendorId, setVendorId] = useState<Id<"vendors"> | null>(null);
  const [vendorName, setVendorName] = useState<string>("");
  const [search, setSearch] = useState("");

  if (vendorId === null) {
    const filtered = (vendors ?? []).filter((v) =>
      v.name.toLowerCase().includes(search.trim().toLowerCase()),
    );
    return (
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New appointment</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Which vendor is this with?
          </p>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vendors…"
            autoFocus
          />
          {vendors === undefined ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No vendors match.{" "}
              <Link href="/admin/vendors/new" className="underline">
                Add one
              </Link>
              .
            </p>
          ) : (
            <ul className="max-h-72 overflow-auto divide-y divide-border rounded-md border border-border">
              {filtered.map((v) => (
                <li key={v._id}>
                  <button
                    type="button"
                    onClick={() => {
                      setVendorId(v._id);
                      setVendorName(v.name);
                    }}
                    className="w-full text-left px-3 py-3 hover:bg-muted text-sm"
                  >
                    <div className="font-medium">{v.name}</div>
                    {v.category && (
                      <div className="text-xs text-muted-foreground">
                        {v.category}
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex justify-end">
            <Button variant="secondary" onClick={onDone}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    );
  }

  return (
    <>
      <div className="px-6 pt-4 -mb-2">
        <button
          type="button"
          onClick={() => {
            setVendorId(null);
            setVendorName("");
          }}
          className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          ← Change vendor
        </button>
        <p className="text-sm font-medium mt-1">{vendorName}</p>
      </div>
      <AppointmentFormBody
        key={vendorId}
        vendorId={vendorId}
        onDone={() => {
          toast.success(`Appointment saved on ${vendorName}`);
          onDone();
        }}
      />
    </>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { UserPlus, CalendarPlus, Store, Gift } from "lucide-react";

// Wired in T8 — temporary stub so this task ships independently.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function GlobalAppointmentDialog(_props: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  return null;
}

export function QuickActions() {
  const [appointmentOpen, setAppointmentOpen] = useState(false);

  return (
    <section className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
      <ActionLink href="/admin/guests/new" icon={<UserPlus className="size-5" />}>
        + Guest
      </ActionLink>
      <button
        type="button"
        onClick={() => setAppointmentOpen(true)}
        className="bg-card border border-border rounded-lg p-3 sm:p-4 min-h-[64px] flex flex-col items-center justify-center gap-1.5 text-xs uppercase tracking-widest hover:bg-muted transition"
      >
        <CalendarPlus className="size-5" />
        + Appt
      </button>
      <ActionLink href="/admin/vendors/new" icon={<Store className="size-5" />}>
        + Vendor
      </ActionLink>
      <ActionLink
        href="/admin/products/new"
        icon={<Gift className="size-5" />}
      >
        + Pick
      </ActionLink>

      <GlobalAppointmentDialog
        open={appointmentOpen}
        onOpenChange={setAppointmentOpen}
      />
    </section>
  );
}

function ActionLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="bg-card border border-border rounded-lg p-3 sm:p-4 min-h-[64px] flex flex-col items-center justify-center gap-1.5 text-xs uppercase tracking-widest hover:bg-muted transition"
    >
      {icon}
      {children}
    </Link>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { api } from "@/lib/convex";
import { type Doc, type Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { AppointmentCard } from "./appointment-card";
import { AppointmentFormDialog } from "./appointment-form";

export function AppointmentsSection({
  vendorId,
  vendorName,
}: {
  vendorId: Id<"vendors">;
  vendorName: string;
}) {
  const appointments = useQuery(api.vendorAppointments.listByVendor, {
    vendorId,
  });
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Doc<"vendorAppointments"> | null>(null);
  const [pastOpen, setPastOpen] = useState(false);
  const [renderTime] = useState(() => Date.now());

  const { upcoming, past } = useMemo(() => {
    if (!appointments) return { upcoming: [], past: [] };
    const now = renderTime;
    const upcomingArr: Doc<"vendorAppointments">[] = [];
    const pastArr: Doc<"vendorAppointments">[] = [];
    for (const a of appointments) {
      if (a.status === "scheduled" && a.startAt >= now) {
        upcomingArr.push(a);
      } else {
        pastArr.push(a);
      }
    }
    // Upcoming: soonest first (already sorted ascending by query).
    // Past: most recent first.
    pastArr.sort((a, b) => b.startAt - a.startAt);
    return { upcoming: upcomingArr, past: pastArr };
  }, [appointments, renderTime]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-heading text-xl">Appointments</h2>
        <Button onClick={() => setCreating(true)} size="sm">
          + Add
        </Button>
      </div>

      {appointments === undefined ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : appointments.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No appointments yet. Schedule one to keep the history straight.
        </p>
      ) : (
        <div className="space-y-3">
          {upcoming.length === 0 && (
            <p className="text-xs text-muted-foreground italic">
              Nothing upcoming.
            </p>
          )}
          {upcoming.map((a) => (
            <AppointmentCard
              key={a._id}
              appointment={a}
              vendorName={vendorName}
              isPast={false}
              onEdit={() => setEditing(a)}
            />
          ))}

          {past.length > 0 && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setPastOpen((v) => !v)}
                className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-muted-foreground py-2"
              >
                {pastOpen ? (
                  <ChevronDown className="size-3" />
                ) : (
                  <ChevronRight className="size-3" />
                )}
                Past · Done ({past.length})
              </button>
              {pastOpen && (
                <div className="space-y-3 mt-2">
                  {past.map((a) => (
                    <AppointmentCard
                      key={a._id}
                      appointment={a}
                      vendorName={vendorName}
                      isPast={true}
                      onEdit={() => setEditing(a)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <AppointmentFormDialog
        open={creating}
        onOpenChange={setCreating}
        vendorId={vendorId}
      />
      <AppointmentFormDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        vendorId={vendorId}
        appointment={editing ?? undefined}
      />
    </section>
  );
}

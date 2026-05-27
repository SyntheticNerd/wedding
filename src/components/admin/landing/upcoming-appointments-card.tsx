"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/lib/convex";
import { buildGoogleCalendarUrl } from "@/lib/google-calendar";

function formatDay(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function UpcomingAppointmentsCard() {
  const rows = useQuery(api.vendorAppointments.listUpcomingAll, { limit: 5 });

  return (
    <section className="space-y-3">
      <h2 className="font-heading text-xl">Upcoming appointments</h2>
      <div className="rounded-lg border border-border bg-card p-4">
        {rows === undefined ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No upcoming appointments. Schedule one from any vendor&apos;s page
            or use{" "}
            <span className="font-medium">+ Appt</span> above.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => {
              const url = buildGoogleCalendarUrl({
                title: `${r.vendorName} meeting`,
                startAt: r.startAt,
                endAt: r.endAt,
                location: r.location,
                notes: r.notes,
              });
              return (
                <li
                  key={r._id}
                  className="py-3 grid grid-cols-[80px_1fr_auto] gap-3 items-center"
                >
                  <div className="text-xs">
                    <div className="font-medium">{formatDay(r.startAt)}</div>
                    <div className="text-muted-foreground">
                      {formatTime(r.startAt)}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <Link
                      href={`/admin/vendors/${r.vendorId}`}
                      className="text-sm font-medium hover:underline block truncate"
                    >
                      {r.vendorName}
                    </Link>
                    {r.location && (
                      <div className="text-xs text-muted-foreground italic truncate">
                        {r.location}
                      </div>
                    )}
                  </div>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener"
                    className="text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-full border border-border bg-muted/40 hover:bg-muted whitespace-nowrap"
                  >
                    📅 Cal
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

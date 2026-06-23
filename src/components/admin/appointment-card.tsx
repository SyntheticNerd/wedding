"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/convex";
import { type Doc } from "../../../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { buildGoogleCalendarUrl } from "@/lib/google-calendar";

const STATUS_ORDER = ["scheduled", "completed", "cancelled"] as const;
type Status = (typeof STATUS_ORDER)[number];

const STATUS_LABEL: Record<Status, string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_CLASS: Record<Status, string> = {
  scheduled: "bg-sage text-cream",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-transparent text-muted-foreground border border-muted-foreground",
};

function nextStatus(current: Status): Status {
  const i = STATUS_ORDER.indexOf(current);
  return STATUS_ORDER[(i + 1) % STATUS_ORDER.length];
}

function formatDay(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTimeRange(startMs: number, endMs: number): string {
  const fmt: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
  const startLabel = new Date(startMs).toLocaleTimeString(undefined, fmt);
  const endLabel = new Date(endMs).toLocaleTimeString(undefined, fmt);
  return startLabel === endLabel
    ? startLabel
    : `${startLabel} – ${endLabel}`;
}

export function AppointmentCard({
  appointment,
  vendorName,
  onEdit,
  isPast,
}: {
  appointment: Doc<"vendorAppointments">;
  vendorName: string;
  onEdit: () => void;
  isPast: boolean;
}) {
  const setStatus = useMutation(api.vendorAppointments.setStatus);
  const softDelete = useMutation(api.vendorAppointments.softDelete);
  const [busy, setBusy] = useState(false);
  const { confirm, confirmDialog } = useConfirm();

  const status = appointment.status as Status;
  const showPastHint = isPast && status === "scheduled";

  const calendarUrl = buildGoogleCalendarUrl({
    title: `${vendorName} meeting`,
    startAt: appointment.startAt,
    endAt: appointment.endAt,
    location: appointment.location,
    notes: appointment.notes,
  });

  async function cycleStatus() {
    if (busy) return;
    setBusy(true);
    try {
      const next = nextStatus(status);
      await setStatus({ id: appointment._id, status: next });
      toast.success(`Marked as ${STATUS_LABEL[next].toLowerCase()}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const ok = await confirm({
      title: `Delete appointment on ${formatDay(appointment.startAt)}?`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await softDelete({ id: appointment._id });
      toast.success("Deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <article
      className={`rounded-md border border-border bg-card p-4 space-y-2 ${
        isPast ? "opacity-75" : ""
      }`}
    >
      {confirmDialog}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium text-sm leading-tight">
            {formatDay(appointment.startAt)}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {formatTimeRange(appointment.startAt, appointment.endAt)}
          </div>
        </div>
        <button
          type="button"
          onClick={cycleStatus}
          disabled={busy}
          aria-label={`Status: ${STATUS_LABEL[status]} (click to change)`}
          className="shrink-0"
        >
          <Badge
            className={`text-[10px] uppercase tracking-widest ${STATUS_CLASS[status]}`}
          >
            {STATUS_LABEL[status]}
          </Badge>
        </button>
      </div>

      {appointment.location && (
        <p className="text-xs italic text-muted-foreground">
          {appointment.location}
        </p>
      )}

      {appointment.notes && (
        <p className="text-sm leading-snug line-clamp-3">{appointment.notes}</p>
      )}

      {showPastHint && (
        <p className="text-xs italic text-muted-foreground">
          Past — mark done?
        </p>
      )}

      <div className="flex items-center gap-2 pt-1">
        <a
          href={calendarUrl}
          target="_blank"
          rel="noopener"
          className="flex-1 min-h-[40px] inline-flex items-center justify-center gap-1.5 text-xs px-3 rounded-full border border-border bg-muted/40 hover:bg-muted transition"
        >
          📅 Add to Google Cal
        </a>
        <Button
          variant="ghost"
          size="icon"
          onClick={onEdit}
          aria-label="Edit appointment"
          className="size-10 rounded-full border border-border"
        >
          <Pencil className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={remove}
          aria-label="Delete appointment"
          className="size-10 rounded-full border border-border"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </article>
  );
}

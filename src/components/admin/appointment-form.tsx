"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/lib/convex";
import { type Doc, type Id } from "../../../convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Status = "scheduled" | "completed" | "cancelled";

type FormValues = {
  date: string;       // YYYY-MM-DD
  startTime: string;  // HH:mm
  endTime: string;    // HH:mm
  location: string;
  notes: string;
  status: Status;
};

const STATUS_LIST: Status[] = ["scheduled", "completed", "cancelled"];
const STATUS_LABEL: Record<Status, string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
};

function defaultEndFromStart(startTime: string): string {
  if (!/^\d{2}:\d{2}$/.test(startTime)) return "";
  const [h, m] = startTime.split(":").map(Number);
  const total = h * 60 + m + 60; // +1h
  const eh = Math.floor((total / 60) % 24);
  const em = total % 60;
  return `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
}

function tsFromDateTime(date: string, time: string): number | null {
  if (!date || !time) return null;
  const ms = new Date(`${date}T${time}`).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function AppointmentFormDialog({
  open,
  onOpenChange,
  vendorId,
  appointment,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorId: Id<"vendors">;
  /** When provided, the form is in edit mode. */
  appointment?: Doc<"vendorAppointments">;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Keying by appointment id (or "new") forces fresh useState on each
          dialog opening — sidesteps the react-hooks/set-state-in-effect
          rule that flagged the registry form in phase 3. */}
      {open && (
        <AppointmentFormBody
          key={appointment?._id ?? "new"}
          vendorId={vendorId}
          appointment={appointment}
          onDone={() => onOpenChange(false)}
        />
      )}
    </Dialog>
  );
}

export function AppointmentFormBody({
  vendorId,
  appointment,
  onDone,
}: {
  vendorId: Id<"vendors">;
  appointment?: Doc<"vendorAppointments">;
  onDone: () => void;
}) {
  const add = useMutation(api.vendorAppointments.add);
  const update = useMutation(api.vendorAppointments.update);

  const [values, setValues] = useState<FormValues>(() =>
    appointment
      ? {
          date: toDateString(appointment.startAt),
          startTime: toTimeString(appointment.startAt),
          endTime: toTimeString(appointment.endAt),
          location: appointment.location ?? "",
          notes: appointment.notes ?? "",
          status: appointment.status as Status,
        }
      : {
          date: toDateString(Date.now()),
          startTime: "09:00",
          endTime: "10:00",
          location: "",
          notes: "",
          status: "scheduled",
        },
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!values.date) {
      toast.error("Pick a date");
      return;
    }
    if (!values.startTime) {
      toast.error("Pick a start time");
      return;
    }
    const startAt = tsFromDateTime(values.date, values.startTime);
    if (startAt === null) {
      toast.error("Invalid start date/time");
      return;
    }
    const endTime = values.endTime || defaultEndFromStart(values.startTime);
    const endAt = tsFromDateTime(values.date, endTime);
    if (endAt === null) {
      toast.error("Invalid end time");
      return;
    }
    if (endAt < startAt) {
      toast.error("End time must be after start");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        vendorId,
        startAt,
        endAt,
        location: values.location || undefined,
        notes: values.notes || undefined,
        status: values.status,
      };
      if (appointment) {
        await update({ id: appointment._id, ...payload });
        toast.success("Saved");
      } else {
        await add(payload);
        toast.success("Added");
      }
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>
          {appointment ? "Edit appointment" : "New appointment"}
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        <Field label="Date">
          <Input
            type="date"
            value={values.date}
            onChange={(e) => setValues((s) => ({ ...s, date: e.target.value }))}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Start">
            <Input
              type="time"
              value={values.startTime}
              onChange={(e) =>
                setValues((s) => ({ ...s, startTime: e.target.value }))
              }
            />
          </Field>
          <Field label="End">
            <Input
              type="time"
              value={values.endTime}
              onChange={(e) =>
                setValues((s) => ({ ...s, endTime: e.target.value }))
              }
              placeholder={defaultEndFromStart(values.startTime) || "10:00"}
            />
          </Field>
        </div>

        <Field label="Location">
          <Input
            value={values.location}
            onChange={(e) =>
              setValues((s) => ({ ...s, location: e.target.value }))
            }
            placeholder="At venue / Zoom / phone…"
          />
        </Field>

        <Field label="Notes">
          <Textarea
            value={values.notes}
            onChange={(e) => setValues((s) => ({ ...s, notes: e.target.value }))}
            placeholder="Agenda, links, anything you want…"
            rows={4}
          />
        </Field>

        <Field label="Status">
          <div className="flex gap-2">
            {STATUS_LIST.map((s) => {
              const active = values.status === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setValues((v) => ({ ...v, status: s }))}
                  className={`text-xs px-3 py-2 rounded-full border min-h-[40px] ${
                    active
                      ? "bg-foreground text-background border-foreground"
                      : "bg-transparent border-border hover:bg-muted"
                  }`}
                  aria-pressed={active}
                >
                  {STATUS_LABEL[s]}
                </button>
              );
            })}
          </div>
        </Field>
      </div>

      <DialogFooter>
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </DialogContent>
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

function toDateString(ms: number): string {
  const d = new Date(ms);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toTimeString(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

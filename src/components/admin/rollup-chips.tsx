"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/lib/convex";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface Chip {
  label: string;
  value: number;
  tone?: string;
}

const COLLAPSE_STORAGE_KEY = "admin:rollup-collapsed";

export function RollupChips() {
  const rollups = useQuery(api.guests.rollups);

  if (rollups === undefined) {
    return (
      <div className="space-y-3">
        <RowSkeleton count={5} />
        <RowSkeleton count={5} />
      </div>
    );
  }

  const invitations: Chip[] = [
    { label: "Total", value: rollups.total },
    { label: "Bride", value: rollups.bride },
    { label: "Groom", value: rollups.groom },
    { label: "Both", value: rollups.both },
    { label: "Plus-ones allowed", value: rollups.plusOnesAllowed },
  ];

  const attendance: Chip[] = [
    { label: "Yes", value: rollups.yes, tone: "text-[var(--status-yes)]" },
    { label: "No", value: rollups.no, tone: "text-[var(--status-no)]" },
    { label: "Pending", value: rollups.pending },
    { label: "Plus-ones confirmed", value: rollups.plusOnesYes },
    {
      label: "Confirmed seats",
      value: rollups.confirmed,
      tone: "text-foreground font-medium",
    },
  ];

  const priority: Chip[] = [
    {
      label: "Must-have",
      value: rollups.mustHave,
      tone: "text-[var(--priority-must-have)]",
    },
    {
      label: "Kind of",
      value: rollups.kindOf,
      tone: "text-[var(--priority-kind-of)]",
    },
    {
      label: "Obligated",
      value: rollups.obligated,
      tone: "text-[var(--priority-obligated)]",
    },
    { label: "Untriaged", value: rollups.priorityUnset },
  ];

  return (
    <div className="space-y-3">
      <ChipRow
        section="invitations"
        title="Invitations"
        chips={invitations}
        collapsedSummary={`${rollups.total} total`}
      />
      <ChipRow
        section="attendance"
        title="Attendance"
        chips={attendance}
        collapsedSummary={`${rollups.confirmed} confirmed · ${rollups.pending} pending`}
      />
      <ChipRow
        section="priority"
        title="Priority"
        chips={priority}
        collapsedSummary={`${rollups.mustHave} must-have · ${rollups.obligated} obligated`}
      />
    </div>
  );
}

/* ----------------------------------------------------------------------
   Per-section row with collapsible header. Open/closed state persists in
   localStorage so the admin's last preference survives navigation and
   page refreshes without needing a server-side setting.
   -------------------------------------------------------------------- */

function ChipRow({
  section,
  title,
  chips,
  collapsedSummary,
}: {
  section: "invitations" | "attendance" | "priority";
  title: string;
  chips: Chip[];
  collapsedSummary?: string;
}) {
  const [open, setOpen] = useState(true);

  // Hydrate from localStorage after mount. Reading window.localStorage
  // during render would cause a hydration mismatch (SSR has no window),
  // so we deliberately defer it to an effect even though that means the
  // first paint shows the default-open state and immediately re-renders
  // if the user previously collapsed the section.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(COLLAPSE_STORAGE_KEY);
      if (!raw) return;
      const stored = JSON.parse(raw) as Partial<
        Record<"invitations" | "attendance" | "priority", boolean>
      >;
      if (typeof stored[section] === "boolean") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setOpen(stored[section]);
      }
    } catch {
      // localStorage unavailable or JSON malformed — keep default.
    }
  }, [section]);

  function toggle() {
    setOpen((prev) => {
      const next = !prev;
      try {
        const raw = window.localStorage.getItem(COLLAPSE_STORAGE_KEY);
        const stored = raw ? JSON.parse(raw) : {};
        window.localStorage.setItem(
          COLLAPSE_STORAGE_KEY,
          JSON.stringify({ ...stored, [section]: next }),
        );
      } catch {
        // Best-effort persistence; ignore quota / private-mode failures.
      }
      return next;
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="group flex items-center gap-1.5 mb-1.5 text-[10px] uppercase tracking-widest text-muted-foreground font-medium hover:text-foreground transition-colors"
      >
        <ChevronDown
          className={cn(
            "size-3 transition-transform",
            open ? "rotate-0" : "-rotate-90",
          )}
          aria-hidden
        />
        <span>{title}</span>
        {!open && collapsedSummary && (
          <span className="ml-2 normal-case tracking-normal font-normal text-muted-foreground/80">
            {collapsedSummary}
          </span>
        )}
      </button>
      {open && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {chips.map((chip) => (
            <div
              key={chip.label}
              className="rounded-md border border-border bg-card px-3 py-2"
            >
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {chip.label}
              </div>
              <div
                className={`text-lg tabular-nums ${chip.tone ?? "font-normal"}`}
              >
                {chip.value}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RowSkeleton({ count }: { count: number }) {
  return (
    <div>
      <Skeleton className="h-3 w-20 mb-1.5" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {Array.from({ length: count }).map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    </div>
  );
}

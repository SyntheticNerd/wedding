"use client";

/**
 * Guest priority (want-level) — shared types, metadata, badge, and inline picker.
 *
 * A private admin triage signal: how much the couple actually wants a guest
 * there, used to trim the list against budget/capacity. Never shown to guests.
 *
 * Design: docs/superpowers/specs/2026-06-24-guest-priority-design.md
 */

import { Check, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type GuestPriority = "must_have" | "kind_of" | "obligated";

interface PriorityMeta {
  readonly value: GuestPriority;
  readonly label: string;
  /** What this level means, for tooltips / menu hints. */
  readonly hint: string;
  /** CSS color token (reuses existing --status-* tokens). */
  readonly token: string;
}

/** Ordered best → most-reluctant. Drives menus, filters, and column order. */
export const PRIORITY_LEVELS: readonly PriorityMeta[] = [
  {
    value: "must_have",
    label: "Must-have",
    hint: "Must be there",
    token: "--priority-must-have", // green
  },
  {
    value: "kind_of",
    label: "Kind of",
    hint: "Kind of want them",
    token: "--priority-kind-of", // amber
  },
  {
    value: "obligated",
    label: "Obligated",
    hint: "Don't really want, but feel obligated",
    token: "--priority-obligated", // rose
  },
];

const META_BY_VALUE: Record<GuestPriority, PriorityMeta> = {
  must_have: PRIORITY_LEVELS[0],
  kind_of: PRIORITY_LEVELS[1],
  obligated: PRIORITY_LEVELS[2],
};

export function priorityMeta(p: GuestPriority): PriorityMeta {
  return META_BY_VALUE[p];
}

/** Colored dot. Standalone so rows can show a compact marker. */
export function PriorityDot({
  priority,
  className,
}: {
  priority: GuestPriority;
  className?: string;
}) {
  const meta = META_BY_VALUE[priority];
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2.5 rounded-full", className)}
      style={{ backgroundColor: `var(${meta.token})` }}
    />
  );
}

/** Dot + label badge. Renders a subtle dash for untriaged guests. */
export function GuestPriorityBadge({
  priority,
  className,
}: {
  priority?: GuestPriority;
  className?: string;
}) {
  if (!priority) {
    return (
      <span className={cn("text-xs text-muted-foreground", className)}>—</span>
    );
  }
  const meta = META_BY_VALUE[priority];
  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 font-medium", className)}
      style={{
        borderColor: `color-mix(in oklch, var(${meta.token}) 45%, transparent)`,
        color: `var(${meta.token})`,
        backgroundColor: `color-mix(in oklch, var(${meta.token}) 10%, transparent)`,
      }}
      title={meta.hint}
    >
      <PriorityDot priority={priority} />
      {meta.label}
    </Badge>
  );
}

/**
 * Inline priority picker — a dropdown whose trigger shows the current badge.
 * Lets an admin tag a guest in one tap straight from the table row.
 */
export function GuestPriorityPicker({
  value,
  onChange,
  disabled,
  ariaLabel,
}: {
  value?: GuestPriority;
  onChange: (next?: GuestPriority) => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        aria-label={ariaLabel ?? "Set priority"}
        className={cn(
          "inline-flex items-center rounded-md outline-none transition-opacity",
          "hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:opacity-50",
        )}
        // Stop the row's click handler (which navigates to the detail page)
        // from firing when the admin opens the picker.
        onClick={(e) => e.stopPropagation()}
      >
        {value ? (
          <GuestPriorityBadge priority={value} />
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground">
            <Circle className="size-2.5" />
            Set
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        {PRIORITY_LEVELS.map((meta) => (
          <DropdownMenuItem
            key={meta.value}
            onClick={() => onChange(meta.value)}
            className="gap-2"
          >
            <PriorityDot priority={meta.value} />
            <span className="flex-1">{meta.label}</span>
            {value === meta.value && <Check className="size-3.5" />}
          </DropdownMenuItem>
        ))}
        {value && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onChange(undefined)}
              className="text-muted-foreground"
            >
              Clear
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

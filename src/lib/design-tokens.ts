/**
 * Wedding site design tokens — single source of truth for palette + type.
 *
 * The palette is also expressed as CSS custom properties in
 * `src/app/globals.css`. To swap the look, edit both files.
 *
 * Why this file exists alongside CSS vars: TS code (charts, status badges,
 * conditional styling) sometimes needs the canonical hex/oklch values without
 * round-tripping through `getComputedStyle`.
 */

export const palette = {
  cream: "#FAF6F1",
  blush: "#A95E55", // deep dusty rose — matches oklch(0.55 0.09 28). Soften with /40-/60 opacity for accents.
  sage: "#9CAE9C",
  charcoal: "#2E2A26",
  white: "#FFFFFF",
} as const;

export const statusColors = {
  yes: "var(--status-yes)",
  no: "var(--status-no)",
  pending: "var(--status-pending)",
  offline: "var(--status-offline)",
} as const;

export type RsvpStatus = "pending" | "yes" | "no";
export type RsvpDisplayStatus = RsvpStatus | "offline";

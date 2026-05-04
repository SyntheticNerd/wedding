/**
 * Re-exports Convex client API references with a friendly path
 * (`@/lib/convex`) so component code doesn't reach into the convex/
 * directory directly.
 */
export { api, internal } from "../../convex/_generated/api";
export type { Doc, Id } from "../../convex/_generated/dataModel";

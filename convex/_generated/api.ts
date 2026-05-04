/* eslint-disable */
/**
 * STUB — replaced by `npx convex dev` / `npx convex codegen`.
 *
 * The real generated api/internal types come from the Convex CLI scanning
 * convex/*.ts and inferring the public/internal function surface. Until
 * regenerated, we use a permissive `any` shape — this lets client code
 * import `api.guests.list` etc. without breaking typecheck. Real types
 * land the moment Andrew runs `npx convex dev`.
 */
import { anyApi } from "convex/server";

export const api: any = anyApi;
export const internal: any = anyApi;

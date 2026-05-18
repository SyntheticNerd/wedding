/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as adminProfiles from "../adminProfiles.js";
import type * as guests from "../guests.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_normalize from "../lib/normalize.js";
import type * as messages from "../messages.js";
import type * as notifications from "../notifications.js";
import type * as notificationsData from "../notificationsData.js";
import type * as rsvp from "../rsvp.js";
import type * as settings from "../settings.js";
import type * as vendors from "../vendors.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  adminProfiles: typeof adminProfiles;
  guests: typeof guests;
  "lib/auth": typeof lib_auth;
  "lib/normalize": typeof lib_normalize;
  messages: typeof messages;
  notifications: typeof notifications;
  notificationsData: typeof notificationsData;
  rsvp: typeof rsvp;
  settings: typeof settings;
  vendors: typeof vendors;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};

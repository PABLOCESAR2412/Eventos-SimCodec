/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as actions from "../actions.js";
import type * as addEkos from "../addEkos.js";
import type * as clear from "../clear.js";
import type * as crons from "../crons.js";
import type * as events from "../events.js";
import type * as providers_CourseraProvider from "../providers/CourseraProvider.js";
import type * as providers_DevpostProvider from "../providers/DevpostProvider.js";
import type * as providers_EventbriteProvider from "../providers/EventbriteProvider.js";
import type * as providers_GenericRssProvider from "../providers/GenericRssProvider.js";
import type * as providers_LumaProvider from "../providers/LumaProvider.js";
import type * as providers_Provider from "../providers/Provider.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  actions: typeof actions;
  addEkos: typeof addEkos;
  clear: typeof clear;
  crons: typeof crons;
  events: typeof events;
  "providers/CourseraProvider": typeof providers_CourseraProvider;
  "providers/DevpostProvider": typeof providers_DevpostProvider;
  "providers/EventbriteProvider": typeof providers_EventbriteProvider;
  "providers/GenericRssProvider": typeof providers_GenericRssProvider;
  "providers/LumaProvider": typeof providers_LumaProvider;
  "providers/Provider": typeof providers_Provider;
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

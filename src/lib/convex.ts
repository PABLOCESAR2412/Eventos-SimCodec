import { ConvexHttpClient } from "convex/browser";
const convexUrl = process.env.CONVEX_URL || import.meta.env.CONVEX_URL || import.meta.env.PUBLIC_CONVEX_URL;
if (!convexUrl) throw new Error("Missing Convex URL");
export const convex = new ConvexHttpClient(convexUrl, {
  fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10_000) }),
});

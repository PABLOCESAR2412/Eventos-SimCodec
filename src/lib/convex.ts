import { ConvexHttpClient } from "convex/browser";
const convexUrl = process.env.CONVEX_URL || import.meta.env.CONVEX_URL || import.meta.env.PUBLIC_CONVEX_URL;
if (!convexUrl) throw new Error("Missing Convex URL");
export const convex = new ConvexHttpClient(convexUrl, {
  fetch: Object.assign((input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
    fetch(input, { ...init, signal: AbortSignal.timeout(10_000) }), fetch),
});

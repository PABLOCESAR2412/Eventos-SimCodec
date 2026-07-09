import { ConvexHttpClient } from "convex/browser";

const convexUrl = import.meta.env.CONVEX_URL || import.meta.env.VITE_CONVEX_URL || import.meta.env.PUBLIC_CONVEX_URL || process.env.CONVEX_URL;

if (!convexUrl) {
  throw new Error("Missing Convex URL in environment variables");
}

export const convex = new ConvexHttpClient(convexUrl);

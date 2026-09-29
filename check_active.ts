import { ConvexHttpClient } from "convex/browser";
import { api } from "./convex/_generated/api";
const url = process.env.CONVEX_URL || process.env.PUBLIC_CONVEX_URL;
if (!url) throw new Error("CONVEX_URL is required");
const client = new ConvexHttpClient(url);
const events = await client.query(api.events.getCatalogPage, { paginationOpts: { cursor: null, numItems: 12 } });
console.log("Active events on first page:", events.page.length, "More pages:", !events.isDone);

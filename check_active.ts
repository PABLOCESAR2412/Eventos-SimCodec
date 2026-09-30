import { ConvexHttpClient } from "convex/browser";
import { api } from "./convex/_generated/api";
const url = process.env.CONVEX_URL || process.env.PUBLIC_CONVEX_URL;
const token = process.env.CATALOG_TOKEN;
if (!url || !token) throw new Error("CONVEX_URL and CATALOG_TOKEN are required");
const client = new ConvexHttpClient(url);
const events = await client.query(api.events.getCatalogData, { token, kind: 'EVENT' });
console.log("Active dated events:", events.length);

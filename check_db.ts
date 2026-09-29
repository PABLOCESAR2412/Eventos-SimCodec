import { ConvexHttpClient } from "convex/browser";
import { api } from "./convex/_generated/api";
const url = process.env.CONVEX_URL || process.env.PUBLIC_CONVEX_URL;
const token = process.env.ADMIN_TOKEN;
if (!url || !token) throw new Error("CONVEX_URL and ADMIN_TOKEN are required");
const client = new ConvexHttpClient(url);
const [events, logs] = await Promise.all([
  client.query(api.events.getAllEventsAdmin, { token, paginationOpts: { cursor: null, numItems: 50 } }),
  client.query(api.events.getAdminLogs, { token }),
]);
console.log("Events on this page:", events.page.length, "More pages:", !events.isDone);
for (const log of logs.slice(0, 5)) console.log(log.status, log.taskName, "Added:", log.eventsAdded, "Updated:", log.eventsUpdated ?? "unknown");

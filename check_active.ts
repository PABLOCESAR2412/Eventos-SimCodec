import { ConvexHttpClient } from "convex/browser";

const client = new ConvexHttpClient(process.env.VITE_CONVEX_URL || process.env.CONVEX_URL!);

async function main() {
  const allEvents = await client.query("events:getAllEventsAdmin" as any);
  console.log("Total events in DB (Admin):", allEvents.length);
  
  const activeEvents = await client.query("events:getActiveEvents" as any, {});
  console.log("Active events returned to frontend:", activeEvents.length);
}

main().catch(console.error);

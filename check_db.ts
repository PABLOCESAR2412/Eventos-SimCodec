import { ConvexHttpClient } from "convex/browser";

const client = new ConvexHttpClient(process.env.VITE_CONVEX_URL || process.env.CONVEX_URL!);

async function main() {
  const events = await client.query("events:getAllEventsAdmin" as any);
  console.log("Total events in DB:", events.length);
  
  const logs = await client.query("events:getAdminLogs" as any);
  console.log("Latest logs:");
  for (const log of logs.slice(0, 5)) {
    console.log(`[${log.status}] ${log.taskName} - Added: ${log.eventsAdded}`);
    if (log.errorMessage) console.log("Error:", log.errorMessage);
  }
}

main().catch(console.error);

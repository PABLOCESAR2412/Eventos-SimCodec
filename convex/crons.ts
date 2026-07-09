import { cronJobs } from "convex/server";
import { api, internal } from "./_generated/api";

const crons = cronJobs();

// Sincronizar fuentes cada 6 horas (Web Scraping y APIs)
crons.interval(
  "sync-events-every-6-hours",
  { hours: 6 }, // Run every 6 hours
  api.actions.syncAllSources
);

// Tarea para validación de links (Link Rotting detection) una vez al día
crons.daily(
  "validate-broken-links",
  { hourUTC: 8, minuteUTC: 0 },
  api.actions.validateEventLinks
);

export default crons;

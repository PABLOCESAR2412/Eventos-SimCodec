import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();

// 1. Sincronizar fuentes de APIs rápidas y confiables (Cada 6 horas)
crons.interval(
  "sync-apis-every-6-hours",
  { hours: 6 },
  api.actions.syncApiSources
);

// 2. Sincronizar RSS Feeds (Cada 12 horas)
crons.interval(
  "sync-rss-every-12-hours",
  { hours: 12 },
  api.actions.syncRssSources
);

// 3. Sincronizar Scraping Pesado (Cada 24 horas)
crons.interval(
  "sync-scraping-every-24-hours",
  { hours: 24 },
  api.actions.syncScrapingSources
);

// 4. Tarea para validación de links (Link Rotting detection) una vez al día
crons.daily(
  "validate-broken-links",
  { hourUTC: 8, minuteUTC: 0 },
  api.actions.validateEventLinks
);

export default crons;

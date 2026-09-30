import { internalAction } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { BATCH_SIZE, normalizeEvent } from "./lib/model";
import type { EventInput } from "./lib/model";
import { safeFetch, SOURCE_HOSTS, LINK_HOSTS, DestinationError } from "./lib/http";
import { parseDevpost, parseCoursera, parseWordpress, parseEventbrite, parseDatedRss } from "./lib/parsers";
type Source = { name: string; url: string; parse: (body: string) => EventInput[] };
async function sync(ctx: ActionCtx, taskName: string, sources: Source[], interval: number) {
  const started = Date.now();
  const counts = { added: 0, updated: 0, skipped: 0, rejected: 0 };
  const errors: string[] = [], details: string[] = [];
  let requests = 0;
  let processed = 0;
  const unique = new Map<string, EventInput>();
  for (const source of sources.slice(0, 10)) {
    if (Date.now() - started > 100_000) { errors.push("Job time budget reached"); break; }
    const state = await ctx.runQuery(internal.sources.get, { url: source.url });
    if (state && state.nextAttemptAt > Date.now()) { details.push(source.name + ": backoff"); continue; }
    let retryAfterMs: number | undefined;
    try {
      const headers: Record<string, string> = {};
      if (state?.etag) headers["If-None-Match"] = state.etag;
      if (state?.modified) headers["If-Modified-Since"] = state.modified;
      const response = await safeFetch(source.url, { hosts: SOURCE_HOSTS, headers, onRequest: () => { requests++; } });
      if (response.status === 304) {
        await ctx.runMutation(internal.sources.record, { url: source.url, failed: false,
          etag: response.headers.get("etag")?.slice(0, 500), modified: response.headers.get("last-modified")?.slice(0, 100) });
        processed++; counts.skipped++; details.push(source.name + ": unchanged HTTP 304"); continue;
      }
      const retry = response.headers.get("retry-after");
      if (retry) retryAfterMs = /^\d+$/.test(retry) ? Number(retry) * 1000 : Math.max(0, Date.parse(retry) - Date.now());
      if (response.status < 200 || response.status >= 300) throw new Error("HTTP " + response.status);
      const candidates = source.parse(response.text);
      for (const candidate of candidates) {
        try {
          const event = normalizeEvent(candidate, started);
          if (unique.has(event.registrationUrl)) counts.skipped++;
          else unique.set(event.registrationUrl, event);
        } catch { counts.rejected++; }
      }
      // Commit normalized data before the validator cache: failed saves remain retryable.
      const pending = [...unique.values()];
      for (let offset = 0; offset < pending.length; offset += BATCH_SIZE) {
        const saved = await ctx.runMutation(internal.events.saveEvents, { events: pending.slice(offset, offset + BATCH_SIZE) });
        counts.added += saved.added; counts.updated += saved.updated; counts.skipped += saved.skipped; counts.rejected += saved.rejected;
      }
      unique.clear();
      processed++;
      await ctx.runMutation(internal.sources.record, { url: source.url, failed: false,
        etag: response.headers.get("etag")?.slice(0, 500), modified: response.headers.get("last-modified")?.slice(0, 100) });
      details.push(source.name + ": " + candidates.length + " candidates");
    } catch (error) {
      errors.push(source.name + ": " + String(error).slice(0, 300));
      await ctx.runMutation(internal.sources.record, { url: source.url, failed: true, retryAfterMs: Number.isFinite(retryAfterMs) ? retryAfterMs : undefined });
    }
  }
  await ctx.runMutation(internal.events.recordJob, { taskName,
    status: !sources.length ? "DISABLED" : errors.length ? (!processed ? "FAILED" : "PARTIAL") : !processed ? "SKIPPED" : counts.rejected ? "PARTIAL" : "SUCCESS",
    eventsAdded: counts.added, eventsUpdated: counts.updated, eventsSkipped: counts.skipped, eventsRejected: counts.rejected,
    durationMs: Date.now() - started, requests, nextRunAt: started + interval,
    details: details.join("; ") || (!sources.length ? "No configured feeds with explicit event dates" : "All sources failed"), errorMessage: errors.length ? errors.join("; ") : undefined });
  return counts;
}
export const syncApiSources = internalAction({
  args: {},
  handler: ctx => sync(ctx, "syncApiSources", [
    { name: "Devpost", url: "https://devpost.com/api/hackathons?status=open", parse: parseDevpost },
    { name: "Coursera", url: "https://api.coursera.org/api/courses.v1?limit=30&fields=description,photoUrl,partnerIds", parse: parseCoursera },
  ], 6 * 3_600_000),
});
export const syncRssSources = internalAction({
  args: {},
  handler: ctx => {
    // Only explicit event start dates are accepted; pubDate is never an event date.
    const feeds: { name: string; url: string }[] = JSON.parse(process.env.RSS_EVENT_FEEDS ?? "[]");
    if (!Array.isArray(feeds) || feeds.length > 10 || feeds.some(f => typeof f.name !== "string" || typeof f.url !== "string")) throw new Error("Invalid RSS_EVENT_FEEDS");
    return sync(ctx, "syncRssSources", feeds.map(f => ({ ...f, parse: body => parseDatedRss(body, f.name) })), 12 * 3_600_000);
  },
});
export const syncScrapingSources = internalAction({
  args: {},
  handler: ctx => {
    const wordpress: { name: string; url: string }[] = JSON.parse(process.env.WORDPRESS_EVENT_SOURCES ?? "[]");
    if (!Array.isArray(wordpress) || wordpress.length > 8 || wordpress.some(s => typeof s.name !== "string" || typeof s.url !== "string")) throw new Error("Invalid WORDPRESS_EVENT_SOURCES");
    return sync(ctx, "syncScrapingSources", [
    { name: "Eventbrite Online", url: "https://www.eventbrite.com/d/online/science-and-tech--events/", parse: parseEventbrite },
    { name: "Eventbrite Ecuador", url: "https://www.eventbrite.com/d/ecuador/science-and-tech--events/", parse: parseEventbrite },
    ...wordpress.map(s => ({ ...s, parse: (body: string) => parseWordpress(body, s.name) })),
    // Old university/CITEC URLs returned 404. EPN's certificate chain also failed.
    ], 24 * 3_600_000);
  },
});
export const validateEventLinks = internalAction({
  args: {},
  handler: async (ctx): Promise<{ checked: number; invalid: number }> => {
    const started = Date.now();
    const events = await ctx.runQuery(internal.events.getEventsForValidation, { now: started });
    const results: { id: typeof events[number]["_id"]; status: number; checkedAt: number }[] = [];
    let requests = 0;
    // Sequential checks cap per-host concurrency at one and job time at 100 seconds.
    for (const event of events) {
      if (Date.now() - started > 100_000) break;
      let status = 0;
      try {
        const response = await safeFetch(event.registrationUrl, { hosts: LINK_HOSTS, method: "HEAD", timeoutMs: 4000, onRequest: () => { requests++; } });
        status = response.status;
        if (status === 405) {
          status = (await safeFetch(event.registrationUrl, { hosts: LINK_HOSTS, maxBytes: 300_000, timeoutMs: 4000, onRequest: () => { requests++; } })).status;
        }
      } catch (error) { if (error instanceof DestinationError) status = -1; }
      results.push({ id: event._id, status, checkedAt: Date.now() });
    }
    const invalid = results.length ? await ctx.runMutation(internal.events.recordLinkResults, { results }) : 0;
    await ctx.runMutation(internal.events.recordJob, { taskName: "validateEventLinks", status: results.some(r => r.status <= 0 || r.status >= 400) ? "PARTIAL" : "SUCCESS",
      eventsAdded: 0, eventsUpdated: results.length, eventsSkipped: events.length - results.length, eventsRejected: invalid,
      durationMs: Date.now() - started, requests, nextRunAt: started + 3_600_000,
      details: results.length + " links checked; " + invalid + " unavailable after repeated 404/410; " + results.filter(r => r.status === -1).length + " destinations require policy review (automatic retry stopped)" });
    return { checked: results.length, invalid };
  },
});

import { query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import type { FilterBuilder } from "convex/server";
import { BATCH_SIZE, DAY, eventInput, eventFields, normalizeEvent, sameContent, requireAdmin } from "./lib/model";
import type { Doc, DataModel } from "./_generated/dataModel";
const strings = v.optional(v.array(v.string()));
const filters = { searchTerm: v.optional(v.string()), categories: strings, cities: strings,
  sources: strings, topics: strings, modalities: strings, costs: strings,
  dateFrom: v.optional(v.number()), dateTo: v.optional(v.number()) };
function publicEvent(e: Doc<"events">) {
  return { _id: e._id, title: e.title, description: e.description, registrationUrl: e.registrationUrl,
    source: e.source, category: e.category, subcategory: e.subcategory, city: e.city,
    isVirtual: e.isVirtual, address: e.address, dateStart: e.dateStart, dateEnd: e.dateEnd,
    isFree: e.isFree, price: e.price, imageUrl: e.imageUrl, kind: e.kind };
}
export const getCatalogPage = query({
  args: { ...filters, paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    for (const values of [args.categories, args.cities, args.sources, args.topics, args.modalities, args.costs]) {
      if (values && (values.length > 60 || values.some(value => value.length > 100))) throw new Error("Invalid filters");
    }
    if ((args.searchTerm?.length ?? 0) > 100 || (args.paginationOpts.cursor?.length ?? 0) > 4096) throw new Error("Invalid search");
    const matches = (e: Doc<"events">) => {
      const text = e.searchText ?? (e.title + " " + e.description + " " + e.category + " " + (e.subcategory ?? "") + " " + e.source).toLowerCase();
      return (!args.categories?.length || args.categories.includes(e.category)) &&
        (!args.cities?.length || args.cities.includes(e.isVirtual ? "Virtual" : e.city ?? "")) &&
        (!args.sources?.length || args.sources.some(s => e.source.includes(s))) &&
        (!args.topics?.length || args.topics.some(s => text.includes(s.toLowerCase()))) &&
        (!args.modalities?.length || args.modalities.includes(e.isVirtual ? "virtual" : "presential")) &&
        (!args.costs?.length || args.costs.includes(e.isFree ? "free" : "paid")) &&
        (args.dateFrom === undefined || (e.kind !== "COURSE" && e.dateStart >= args.dateFrom)) &&
        (args.dateTo === undefined || (e.kind !== "COURSE" && e.dateStart < args.dateTo));
    };
    const options = { cursor: args.paginationOpts.cursor, numItems: Math.max(1, Math.min(48, Math.floor(args.paginationOpts.numItems))),
      maximumRowsRead: 256, maximumBytesRead: 600_000 };
    const databaseFilters = (q: FilterBuilder<DataModel["events"]>) => q.and(
      ...[args.categories?.length ? q.or(...args.categories.map(c => q.eq(q.field("category"), c))) : undefined,
        args.cities?.length ? q.or(...args.cities.map(c => c === "Virtual" ? q.eq(q.field("isVirtual"), true) : q.and(q.eq(q.field("isVirtual"), false), q.eq(q.field("city"), c)))) : undefined,
        args.sources?.length ? q.or(...args.sources.map(s => q.eq(q.field("source"), s))) : undefined,
        args.modalities?.length === 1 ? q.eq(q.field("isVirtual"), args.modalities[0] === "virtual") : undefined,
        args.costs?.length === 1 ? q.eq(q.field("isFree"), args.costs[0] === "free") : undefined,
        args.dateFrom !== undefined ? q.gte(q.field("dateStart"), args.dateFrom) : undefined,
        args.dateTo !== undefined ? q.lt(q.field("dateStart"), args.dateTo) : undefined,
      ].filter((expression): expression is NonNullable<typeof expression> => expression !== undefined)
    );
    const result = args.searchTerm?.trim()
      ? await ctx.db.query("events").withSearchIndex("search_catalog", q => q.search("searchText", args.searchTerm!.trim()).eq("status", "PUBLISHED").eq("isLinkValid", true)).paginate(options)
      : args.categories?.length === 1
        ? await ctx.db.query("events").withIndex("by_catalog_category", q => q.eq("status", "PUBLISHED").eq("isLinkValid", true).eq("category", args.categories![0])).filter(databaseFilters).paginate(options)
        : await ctx.db.query("events").withIndex("by_catalog", q => q.eq("status", "PUBLISHED").eq("isLinkValid", true)).filter(databaseFilters).paginate(options);
    return { ...result, page: result.page.filter(matches).map(publicEvent) };
  },
});
// Bounded compatibility endpoint for the previous frontend during rollout.
export const getActiveEvents = query({
  args: { searchTerm: v.optional(v.string()), category: v.optional(v.string()), isFree: v.optional(v.boolean()), isVirtual: v.optional(v.boolean()), city: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const page = await ctx.db.query("events").withIndex("by_catalog", q => q.eq("status", "PUBLISHED").eq("isLinkValid", true)).take(48);
    return page.filter(e => (!args.category || e.category === args.category) &&
      (args.isFree === undefined || e.isFree === args.isFree) && (args.isVirtual === undefined || e.isVirtual === args.isVirtual) &&
      (!args.city || e.city === args.city) && (!args.searchTerm || (e.title + " " + e.description).toLowerCase().includes(args.searchTerm.slice(0, 100).toLowerCase()))).map(publicEvent);
  },
});
export const saveEvents = internalMutation({
  args: { events: v.array(eventInput) },
  handler: async (ctx, args) => {
    if (args.events.length > BATCH_SIZE) throw new Error("Batch exceeds 100 events");
    const counts = { added: 0, updated: 0, skipped: 0, rejected: 0 };
    const seen = new Set<string>();
    for (const input of args.events) {
      let event;
      try { event = normalizeEvent(input, Date.now()); } catch { counts.rejected++; continue; }
      const key = event.registrationUrl;
      if (seen.has(key)) { counts.skipped++; continue; }
      seen.add(key);
      let existing = await ctx.db.query("events").withIndex("by_canonicalUrl", q => q.eq("canonicalUrl", key)).first();
      if (!existing && event.externalId) existing = await ctx.db.query("events").withIndex("by_externalId", q => q.eq("externalId", event.externalId)).first();
      const metadata = { canonicalUrl: key, searchText: (event.title + " " + event.description + " " + event.category + " " + (event.subcategory ?? "") + " " + (existing?.source ?? event.source) + " " + (event.organizer ?? "")).toLowerCase(),
        expiresAt: event.kind === "COURSE" ? Number.MAX_SAFE_INTEGER : event.dateEnd ?? event.dateStart + DAY, migrationVersion: 1 };
      if (!existing) {
        await ctx.db.insert("events", { ...event, ...metadata, updatedAt: Date.now(), nextLinkCheck: Date.now(), linkFailures: 0 });
        counts.added++;
      } else if (!sameContent(existing as unknown as Record<string, unknown>, event)) {
        const fields = Object.fromEntries(Object.keys(eventFields).map(key => [key, (event as unknown as Record<string, unknown>)[key]])) as typeof event;
        await ctx.db.patch(existing._id, { ...fields, ...metadata, externalId: existing.externalId ?? event.externalId,
          source: existing.source, isLinkValid: existing.isLinkValid, updatedAt: Date.now(),
          dateEnd: event.dateEnd, imageUrl: event.imageUrl, price: event.price });
        counts.updated++;
      } else { counts.skipped++; }
    }
    return counts;
  },
});
export const getEventsForValidation = internalQuery({
  args: { now: v.number() },
  handler: async (ctx, { now }) => (await ctx.db.query("events")
    .withIndex("by_link_due", q => q.eq("status", "PUBLISHED").lte("nextLinkCheck", now)).take(100))
    .map(e => ({ _id: e._id, registrationUrl: e.registrationUrl, linkFailures: e.linkFailures ?? 0 })),
});
export const recordLinkResults = internalMutation({
  args: { results: v.array(v.object({ id: v.id("events"), status: v.number(), checkedAt: v.number() })) },
  handler: async (ctx, { results }) => {
    if (results.length > 100) throw new Error("Too many link results");
    let invalid = 0;
    for (const result of results) {
      const event = await ctx.db.get(result.id);
      if (!event || event.status !== "PUBLISHED") continue;
      const success = result.status >= 200 && result.status < 400;
      const gone = result.status === 404 || result.status === 410;
      const failures = success ? 0 : (event.linkFailures ?? 0) + 1;
      const isLinkValid = success ? true : gone && failures >= 2 ? false : event.isLinkValid;
      if (!isLinkValid) invalid++;
      await ctx.db.patch(event._id, { isLinkValid, linkFailures: failures,
        lastLinkCheck: result.checkedAt, lastLinkStatus: result.status,
        nextLinkCheck: result.checkedAt + (success ? 7 * DAY : Math.min(7 * DAY, 6 * 3_600_000 * 2 ** Math.min(failures - 1, 5))) });
    }
    return invalid;
  },
});
export const recordJob = internalMutation({
  args: { taskName: v.string(), status: v.string(), eventsAdded: v.number(), eventsUpdated: v.number(), eventsSkipped: v.number(), eventsRejected: v.number(), durationMs: v.number(), requests: v.number(), nextRunAt: v.number(), details: v.string(), errorMessage: v.optional(v.string()) },
  handler: async (ctx, args) => { await ctx.db.insert("cronLogs", { ...args, details: args.details.slice(0, 4000), errorMessage: args.errorMessage?.slice(0, 2000), executedAt: Date.now() }); },
});
export const getAllEventsAdmin = query({
  args: { token: v.string(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    requireAdmin(args.token);
    return ctx.db.query("events").order("desc").paginate({ cursor: args.paginationOpts.cursor, numItems: Math.min(50, Math.max(1, args.paginationOpts.numItems)), maximumRowsRead: 50, maximumBytesRead: 200_000 });
  },
});
export const getAdminLogs = query({
  args: { token: v.string() },
  handler: async (ctx, args) => { requireAdmin(args.token); return ctx.db.query("cronLogs").order("desc").take(30); },
});

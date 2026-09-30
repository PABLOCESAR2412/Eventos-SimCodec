import { query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import {
  BATCH_SIZE,
  DAY,
  eventInput,
  eventFields,
  normalizeEvent,
  sameContent,
  requireAdmin,
  requireSecret,
} from "./lib/model";
import { CATALOG_ROWS, CATALOG_BYTES, priceInfo } from "../shared/domain";
import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
function publicEvent(e: Doc<"events">) {
  return {
    _id: e._id,
    title: e.title,
    description: e.description,
    registrationUrl: e.registrationUrl,
    source: e.source,
    category: e.category,
    subcategory: e.subcategory,
    city: e.city,
    isVirtual: e.isVirtual,
    address: e.address,
    dateStart: e.dateStart,
    dateEnd: e.dateEnd,
    isFree: e.isFree,
    price: e.price,
    ...priceInfo(e),
    imageUrl: e.imageUrl,
    kind: e.kind,
    searchText: e.searchText,
  };
}
async function readCatalog(ctx: QueryCtx, kind: "EVENT" | "COURSE") {
  const options = {
    cursor: null,
    numItems: CATALOG_ROWS,
    maximumRowsRead: CATALOG_ROWS,
    maximumBytesRead: CATALOG_BYTES,
  };
  const candidates = await ctx.db
    .query("events")
    .withIndex("by_catalog_kind", (q) =>
      q.eq("status", "PUBLISHED").eq("isLinkValid", true).eq("kind", kind),
    )
    .paginate(options);
  if (!candidates.isDone)
    throw new Error(
      "CATALOG_CAPACITY: bounded catalog exceeded; create a materialized catalog before increasing capacity",
    );
  return candidates.page.map(publicEvent);
}
export const getCatalogData = query({
  args: {
    token: v.string(),
    kind: v.union(v.literal("EVENT"), v.literal("COURSE")),
  },
  handler: async (ctx, args) => {
    requireSecret(args.token, process.env.CATALOG_TOKEN);
    return readCatalog(ctx, args.kind);
  },
});
export const saveEvents = internalMutation({
  args: { events: v.array(eventInput) },
  handler: async (ctx, args) => {
    if (args.events.length > BATCH_SIZE)
      throw new Error("Batch exceeds 100 events");
    const counts = { added: 0, updated: 0, skipped: 0, rejected: 0 };
    const seen = new Set<string>();
    for (const input of args.events) {
      let event;
      try {
        event = normalizeEvent(input, Date.now());
      } catch {
        counts.rejected++;
        continue;
      }
      const key = event.registrationUrl;
      if (seen.has(key)) {
        counts.skipped++;
        continue;
      }
      seen.add(key);
      let existing = await ctx.db
        .query("events")
        .withIndex("by_canonicalUrl", (q) => q.eq("canonicalUrl", key))
        .first();
      if (!existing && event.externalId)
        existing = await ctx.db
          .query("events")
          .withIndex("by_externalId", (q) =>
            q.eq("externalId", event.externalId),
          )
          .first();
      const metadata = {
        canonicalUrl: key,
        searchText: (
          event.title +
          " " +
          event.description +
          " " +
          event.category +
          " " +
          (event.subcategory ?? "") +
          " " +
          (existing?.source ?? event.source) +
          " " +
          (event.organizer ?? "")
        ).toLowerCase(),
        expiresAt:
          event.kind === "COURSE"
            ? Number.MAX_SAFE_INTEGER
            : (event.dateEnd ?? event.dateStart + DAY),
        migrationVersion: 2,
      };
      if (!existing) {
        await ctx.db.insert("events", {
          ...event,
          ...metadata,
          updatedAt: Date.now(),
          nextLinkCheck: Date.now(),
          linkFailures: 0,
        });
        counts.added++;
      } else if (
        !sameContent(existing as unknown as Record<string, unknown>, event)
      ) {
        const fields = Object.fromEntries(
          Object.keys(eventFields).map((key) => [
            key,
            (event as unknown as Record<string, unknown>)[key],
          ]),
        ) as typeof event;
        await ctx.db.patch(existing._id, {
          ...fields,
          ...metadata,
          externalId: existing.externalId ?? event.externalId,
          source: existing.source,
          isLinkValid: existing.isLinkValid,
          updatedAt: Date.now(),
          dateEnd: event.dateEnd,
          imageUrl: event.imageUrl,
          price: event.price,
        });
        counts.updated++;
      } else {
        counts.skipped++;
      }
    }
    return counts;
  },
});
export const getEventsForValidation = internalQuery({
  args: { now: v.number() },
  handler: async (ctx, { now }) =>
    (
      await ctx.db
        .query("events")
        .withIndex("by_link_due", (q) =>
          q.eq("status", "PUBLISHED").lte("nextLinkCheck", now),
        )
        .take(100)
    ).map((e) => ({
      _id: e._id,
      registrationUrl: e.registrationUrl,
      linkFailures: e.linkFailures ?? 0,
    })),
});
export const recordLinkResults = internalMutation({
  args: {
    results: v.array(
      v.object({
        id: v.id("events"),
        status: v.number(),
        checkedAt: v.number(),
      }),
    ),
  },
  handler: async (ctx, { results }) => {
    if (results.length > 100) throw new Error("Too many link results");
    let invalid = 0;
    for (const result of results) {
      const event = await ctx.db.get(result.id);
      if (!event || event.status !== "PUBLISHED") continue;
      const success = result.status >= 200 && result.status < 400;
      const gone = result.status === 404 || result.status === 410;
      const failures = success ? 0 : (event.linkFailures ?? 0) + 1;
      const goneFailures = gone ? (event.linkGoneFailures ?? 0) + 1 : 0;
      const isLinkValid = success
        ? true
        : gone && goneFailures >= 2
          ? false
          : event.isLinkValid;
      if (!isLinkValid) invalid++;
      await ctx.db.patch(event._id, {
        isLinkValid,
        linkFailures: failures,
        linkGoneFailures: goneFailures,
        lastLinkCheck: result.checkedAt,
        lastLinkStatus: result.status,
        nextLinkCheck:
          result.status === -1
            ? Number.MAX_SAFE_INTEGER
            : result.checkedAt +
              (success
                ? 7 * DAY
                : Math.min(
                    7 * DAY,
                    6 * 3_600_000 * 2 ** Math.min(failures - 1, 5),
                  )),
      });
    }
    return invalid;
  },
});
export const recordJob = internalMutation({
  args: {
    taskName: v.string(),
    status: v.string(),
    eventsAdded: v.number(),
    eventsUpdated: v.number(),
    eventsSkipped: v.number(),
    eventsRejected: v.number(),
    durationMs: v.number(),
    requests: v.number(),
    nextRunAt: v.number(),
    details: v.string(),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("cronLogs", {
      ...args,
      details: args.details.slice(0, 4000),
      errorMessage: args.errorMessage?.slice(0, 2000),
      executedAt: Date.now(),
    });
  },
});
export const getAllEventsAdmin = query({
  args: { token: v.string(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    requireAdmin(args.token);
    return ctx.db
      .query("events")
      .order("desc")
      .paginate({
        cursor: args.paginationOpts.cursor,
        numItems: Math.min(50, Math.max(1, args.paginationOpts.numItems)),
        maximumRowsRead: 50,
        maximumBytesRead: 200_000,
      });
  },
});
export const getAdminLogs = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    requireAdmin(args.token);
    return ctx.db.query("cronLogs").order("desc").take(30);
  },
});

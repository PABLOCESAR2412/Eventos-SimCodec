import {
  internalMutation,
  internalQuery,
  internalAction,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { canonicalUrl, DAY } from "./lib/model";
import { priceInfo } from "../shared/domain";
export const repairLegacyLinkHealth = internalMutation({
  args: {},
  handler: async (ctx) => {
    const result = await ctx.db
      .query("events")
      .withIndex("by_catalog", (q) =>
        q.eq("status", "PUBLISHED").eq("isLinkValid", false),
      )
      .paginate({
        cursor: null,
        numItems: 100,
        maximumRowsRead: 100,
        maximumBytesRead: 400_000,
      });
    if (!result.isDone)
      throw new Error("Legacy link repair exceeds batch budget");
    let restored = 0;
    for (const event of result.page) {
      // Old mixed failure counters cannot prove two consecutive 404/410s.
      // New-policy invalid links retain a gone counter of at least two.
      if (
        (event.lastLinkStatus === 404 || event.lastLinkStatus === 410) &&
        event.linkGoneFailures === 0
      ) {
        await ctx.db.patch(event._id, {
          isLinkValid: true,
          nextLinkCheck: Date.now(),
        });
        restored++;
      }
    }
    return { restored };
  },
});
export const repairContracts = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, args) => {
    const result = await ctx.db.query("events").paginate({
      cursor: args.cursor ?? null,
      numItems: 100,
      maximumRowsRead: 100,
      maximumBytesRead: 400_000,
    });
    let repaired = 0,
      quarantined = 0;
    for (const event of result.page) {
      if ((event.migrationVersion ?? 0) >= 2) continue;
      const inverted =
        event.dateEnd !== undefined && event.dateEnd < event.dateStart;
      const price = priceInfo(event);
      await ctx.db.patch(event._id, {
        ...price,
        isFree: price.priceStatus === "FREE",
        kind: event.kind ?? (event.source === "Coursera" ? "COURSE" : "EVENT"),
        migrationVersion: 2,
        linkGoneFailures: 0,
        ...(inverted
          ? {
              originalDates: {
                dateStart: event.dateStart,
                dateEnd: event.dateEnd!,
              },
              dateEnd: undefined,
              expiresAt: event.dateStart + DAY,
              status: "QUARANTINED",
              quarantineReason:
                "Historical end date precedes start; original dates preserved",
            }
          : {}),
      });
      repaired++;
      if (inverted) quarantined++;
    }
    if (!result.isDone)
      await ctx.scheduler.runAfter(0, internal.maintenance.repairContracts, {
        cursor: result.continueCursor,
      });
    return { repaired, quarantined, done: result.isDone };
  },
});
export const migrate = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, args) => {
    const result = await ctx.db.query("events").paginate({
      cursor: args.cursor ?? null,
      numItems: 100,
      maximumRowsRead: 100,
      maximumBytesRead: 400_000,
    });
    let migrated = 0,
      quarantined = 0,
      finished = 0;
    for (const event of result.page) {
      if ((event.migrationVersion ?? 0) >= 1) continue;
      const course = event.source === "Coursera";
      let reason: string | undefined;
      if (
        /^(rss-|news-|devto-|meetup-)/.test(event.externalId ?? "") ||
        event.tags.includes("News")
      )
        reason = "Legacy feed used publication or fabricated event dates";
      if (event.source === "Luma") reason = "Simulated source";
      if (
        !Number.isFinite(event.dateStart) ||
        (!course && event.dateStart <= 0)
      )
        reason = "Invalid start date";
      if (event.dateEnd !== undefined && event.dateEnd < event.dateStart)
        reason = "Historical end date precedes start";
      let url: string | undefined;
      try {
        url = canonicalUrl(event.registrationUrl);
      } catch {
        reason = "Invalid registration URL";
      }
      if (url && !reason) {
        const duplicate = await ctx.db
          .query("events")
          .withIndex("by_canonicalUrl", (q) => q.eq("canonicalUrl", url))
          .first();
        if (duplicate && duplicate._id !== event._id)
          reason = "Duplicate canonical URL";
      }
      const expiresAt = course
        ? Number.MAX_SAFE_INTEGER
        : (event.dateEnd ?? event.dateStart + DAY);
      const status = reason
        ? "QUARANTINED"
        : expiresAt < Date.now()
          ? "FINISHED"
          : event.status;
      await ctx.db.patch(event._id, {
        canonicalUrl: url,
        searchText: (
          event.title +
          " " +
          event.description +
          " " +
          event.category +
          " " +
          (event.subcategory ?? "") +
          " " +
          event.source
        ).toLowerCase(),
        kind: course ? "COURSE" : "EVENT",
        dateStart: course ? 0 : event.dateStart,
        dateEnd: course ? undefined : event.dateEnd,
        expiresAt: Number.isFinite(expiresAt) ? expiresAt : 0,
        status,
        quarantineReason: reason,
        nextLinkCheck: event.lastLinkCheck
          ? event.lastLinkCheck + 7 * DAY
          : Date.now(),
        linkFailures: 0,
        migrationVersion: 1,
      });
      migrated++;
      if (reason) quarantined++;
      if (status === "FINISHED") finished++;
    }
    if (!result.isDone)
      await ctx.scheduler.runAfter(0, internal.maintenance.migrate, {
        cursor: result.continueCursor,
      });
    return { migrated, quarantined, finished, done: result.isDone };
  },
});
export const expire = internalMutation({
  args: {},
  handler: async (ctx) => {
    const expired = await ctx.db
      .query("events")
      .withIndex("by_expiry", (q) =>
        q
          .eq("status", "PUBLISHED")
          .gt("expiresAt", 0)
          .lt("expiresAt", Date.now()),
      )
      .take(100);
    for (const event of expired)
      await ctx.db.patch(event._id, { status: "FINISHED" });
    if (expired.length === 100)
      await ctx.scheduler.runAfter(1000, internal.maintenance.expire, {});
    // Retain events for reversible review; only operational logs have automatic retention.
    const oldLogs = await ctx.db
      .query("cronLogs")
      .withIndex("by_executedAt", (q) =>
        q.lt("executedAt", Date.now() - 90 * DAY),
      )
      .take(100);
    for (const log of oldLogs) await ctx.db.delete(log._id);
    if (oldLogs.length === 100)
      await ctx.scheduler.runAfter(1000, internal.maintenance.expire, {});
    return { expired: expired.length, logsPruned: oldLogs.length };
  },
});

export const archiveCandidates = internalQuery({
  args: {
    status: v.union(v.literal("FINISHED"), v.literal("QUARANTINED")),
    cutoff: v.number(),
  },
  handler: async (ctx, args) =>
    ctx.db
      .query("events")
      .withIndex("by_expiry", (q) =>
        q.eq("status", args.status).lte("expiresAt", args.cutoff),
      )
      .take(50),
});
export const commitArchive = internalMutation({
  args: {
    storageId: v.id("_storage"),
    status: v.string(),
    records: v.array(
      v.object({ id: v.id("events"), updatedAt: v.optional(v.number()) }),
    ),
  },
  handler: async (ctx, args) => {
    if (args.records.length > 50) throw new Error("Archive exceeds 50 records");
    let removed = 0;
    for (const record of args.records) {
      const current = await ctx.db.get(record.id);
      if (
        current?.status === args.status &&
        current.updatedAt === record.updatedAt &&
        (current.migrationVersion ?? 0) >= 1
      ) {
        await ctx.db.delete(record.id);
        removed++;
      }
    }
    // The stored archive includes every original record, even if a concurrent update prevents deletion.
    await ctx.db.insert("eventArchives", {
      storageId: args.storageId,
      count: args.records.length,
      archivedAt: Date.now(),
      status: args.status,
    });
    return removed;
  },
});
export const archive = internalAction({
  args: {},
  handler: async (ctx): Promise<{ archived: number }> => {
    let archived = 0;
    for (const status of ["QUARANTINED", "FINISHED"] as const) {
      for (let batch = 0; batch < 5; batch++) {
        const events = await ctx.runQuery(
          internal.maintenance.archiveCandidates,
          {
            status,
            cutoff:
              status === "QUARANTINED"
                ? Number.MAX_SAFE_INTEGER
                : Date.now() - 90 * DAY,
          },
        );
        if (!events.length) break;
        // Persist the complete original documents before committing any database removal.
        const storageId = await ctx.storage.store(
          new Blob([JSON.stringify({ version: 1, events })], {
            type: "application/json",
          }),
        );
        const removed: number = await ctx.runMutation(
          internal.maintenance.commitArchive,
          {
            storageId,
            status,
            records: events.map((event) => ({
              id: event._id,
              updatedAt: event.updatedAt,
            })),
          },
        );
        archived += removed;
        if (events.length < 50) break;
      }
    }
    return { archived };
  },
});

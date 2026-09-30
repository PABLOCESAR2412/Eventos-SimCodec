import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { eventFields } from "./lib/model";
export default defineSchema({
  events: defineTable({
    ...eventFields,
    canonicalUrl: v.optional(v.string()),
    searchText: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    lastLinkCheck: v.optional(v.number()),
    nextLinkCheck: v.optional(v.number()),
    linkFailures: v.optional(v.number()),
    linkGoneFailures: v.optional(v.number()),
    originalDates: v.optional(
      v.object({ dateStart: v.number(), dateEnd: v.number() }),
    ),
    lastLinkStatus: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
    quarantineReason: v.optional(v.string()),
    migrationVersion: v.optional(v.number()),
  })
    .index("by_externalId", ["externalId"])
    .index("by_canonicalUrl", ["canonicalUrl"])
    .index("by_catalog", ["status", "isLinkValid", "dateStart"])
    .index("by_catalog_kind", ["status", "isLinkValid", "kind", "dateStart"])
    .index("by_expiry", ["status", "expiresAt"])
    .index("by_link_due", ["status", "nextLinkCheck"]),
  cronLogs: defineTable({
    taskName: v.string(),
    status: v.string(),
    eventsAdded: v.number(),
    eventsUpdated: v.optional(v.number()),
    eventsSkipped: v.optional(v.number()),
    eventsRejected: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    requests: v.optional(v.number()),
    nextRunAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    details: v.optional(v.string()),
    executedAt: v.number(),
  }).index("by_executedAt", ["executedAt"]),
  sourceState: defineTable({
    url: v.string(),
    etag: v.optional(v.string()),
    modified: v.optional(v.string()),
    nextAttemptAt: v.number(),
    failures: v.number(),
  }).index("by_url", ["url"]),
  eventArchives: defineTable({
    storageId: v.id("_storage"),
    count: v.number(),
    archivedAt: v.number(),
    status: v.string(),
  }),
});

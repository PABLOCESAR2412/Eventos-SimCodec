import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  events: defineTable({
    title: v.string(),
    description: v.string(),
    dateStart: v.number(), // timestamp
    dateEnd: v.optional(v.number()), // timestamp
    timeString: v.optional(v.string()),
    externalId: v.optional(v.string()), // ID externo para evitar duplicados de APIs

    // Ubicación
    city: v.optional(v.string()),
    province: v.optional(v.string()),
    country: v.string(),
    isVirtual: v.boolean(),
    isHybrid: v.boolean(),
    address: v.optional(v.string()),
    mapUrl: v.optional(v.string()),

    // Multimedia
    imageUrl: v.optional(v.string()),

    // Metadatos
    organizer: v.optional(v.string()),
    category: v.string(),
    subcategory: v.optional(v.string()),

    // Costo
    isFree: v.boolean(),
    price: v.optional(v.string()),

    // URLs
    officialUrl: v.optional(v.string()),
    registrationUrl: v.string(),

    // Estados
    status: v.string(), // DRAFT, PUBLISHED, CANCELLED, FINISHED
    language: v.string(),
    durationMinutes: v.optional(v.number()),
    tags: v.array(v.string()),

    // Cupos
    capacity: v.optional(v.number()),
    availableSpots: v.optional(v.number()),

    // Tracking
    source: v.string(),
    apiUsed: v.optional(v.string()),
    isLinkValid: v.boolean(),
    lastLinkCheck: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  })
    .index("by_category", ["category"])
    .index("by_date", ["dateStart"])
    .index("by_source", ["source"])
    .index("by_status", ["status"])
    .index("by_externalId", ["externalId"])
    .index("by_registrationUrl", ["registrationUrl"]),
    
  cronLogs: defineTable({
    taskName: v.string(),
    status: v.string(),
    eventsAdded: v.number(),
    errorMessage: v.optional(v.string()),
    details: v.optional(v.string()),
    executedAt: v.number(),
  }),
});

import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Consulta pública con Buscador y Filtros integrados
export const getActiveEvents = query({
  args: {
    searchTerm: v.optional(v.string()),
    category: v.optional(v.string()),
    isFree: v.optional(v.boolean()),
    isVirtual: v.optional(v.boolean()),
    city: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let eventsQuery = ctx.db
      .query("events")
      .withIndex("by_status", (q) => q.eq("status", "PUBLISHED"))
      .filter((q) => q.eq(q.field("isLinkValid"), true));

    if (args.category) {
      eventsQuery = eventsQuery.filter(q => q.eq(q.field("category"), args.category));
    }
    if (args.isFree !== undefined) {
      eventsQuery = eventsQuery.filter(q => q.eq(q.field("isFree"), args.isFree));
    }
    if (args.isVirtual !== undefined) {
      eventsQuery = eventsQuery.filter(q => q.eq(q.field("isVirtual"), args.isVirtual));
    }
    if (args.city) {
      eventsQuery = eventsQuery.filter(q => q.eq(q.field("city"), args.city));
    }

    const allEvents = await eventsQuery.collect();

    // Filtramos en memoria los eventos que realmente ya terminaron.
    // Un evento sigue activo si su dateEnd >= ahora, o si no tiene dateEnd, le damos 24 horas de gracia desde dateStart.
    let result = allEvents.filter(e => {
      if (e.dateEnd) return e.dateEnd >= now;
      return e.dateStart >= now - (24 * 60 * 60 * 1000);
    });
    
    // Búsqueda por texto (Search Engine local)
    if (args.searchTerm) {
      const term = args.searchTerm.toLowerCase();
      result = result.filter(e => 
        e.title.toLowerCase().includes(term) || 
        e.description.toLowerCase().includes(term) ||
        (e.organizer && e.organizer.toLowerCase().includes(term))
      );
    }

    // Ordenar por fecha de inicio más cercana
    return result.sort((a, b) => a.dateStart - b.dateStart);
  },
});

// Guardar eventos recolectados por el Action Scraper
export const saveEvents = internalMutation({
  args: {
    events: v.array(v.any()),
    details: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    let added = 0;
    for (const event of args.events) {
      // Verificar si ya existe para no duplicar (usando externalId si existe, o registrationUrl como fallback)
      let existing;
      if (event.externalId) {
        existing = await ctx.db
          .query("events")
          .withIndex("by_externalId", (q) => q.eq("externalId", event.externalId))
          .first();
      }
      
      if (!existing && event.registrationUrl) {
        existing = await ctx.db
          .query("events")
          .withIndex("by_registrationUrl", (q) => q.eq("registrationUrl", event.registrationUrl))
          .first();
      }
        
      if (!existing) {
        await ctx.db.insert("events", event);
        added++;
      } else if (event.updatedAt && (!existing.updatedAt || event.updatedAt > existing.updatedAt)) {
        // Actualizar registro si los datos provistos son más recientes
        await ctx.db.patch(existing._id, event);
      }
    }

    await ctx.db.insert("cronLogs", {
      taskName: "syncAllSources",
      status: "SUCCESS",
      eventsAdded: added,
      details: args.details,
      executedAt: Date.now(),
    });
  }
});

// Obtener todos los eventos publicados para validación
export const getEventsForValidation = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("events")
      .filter((q) => q.eq(q.field("status"), "PUBLISHED"))
      .filter((q) => q.eq(q.field("isLinkValid"), true))
      .collect();
  }
});

// Invalidar un enlace roto
export const invalidateEventLink = internalMutation({
  args: { id: v.id("events") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { isLinkValid: false });
  }
});

// Registrar auditoría de links
export const logLinkValidation = internalMutation({
  args: { total: v.number(), invalid: v.number() },
  handler: async (ctx, args) => {
    await ctx.db.insert("cronLogs", {
      taskName: "validateLinks",
      status: "SUCCESS",
      eventsAdded: 0,
      errorMessage: `Audited ${args.total} links. Found ${args.invalid} broken links.`,
      executedAt: Date.now(),
    });
  }
});

// Admin Dashboard Queries
export const getAllEventsAdmin = query({
  args: {},
  handler: async (ctx) => {
    const events = await ctx.db.query("events").order("desc").collect();
    return events;
  }
});

export const getAdminLogs = query({
  args: {},
  handler: async (ctx) => {
    const logs = await ctx.db.query("cronLogs").order("desc").take(50);
    return logs;
  }
});

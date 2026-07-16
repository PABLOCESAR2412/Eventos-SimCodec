import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { DevpostProvider } from "./providers/DevpostProvider";
import { CourseraProvider } from "./providers/CourseraProvider";
import { LumaProvider } from "./providers/LumaProvider";
import { EventbriteProvider } from "./providers/EventbriteProvider";

const now = Date.now();

// ==========================================
// 1. APIs (Cada 6 horas)
// ==========================================
export const syncApiSources = action({
  args: {},
  handler: async (ctx) => {
    const eventsToSave = [];

    // Devpost
    try {
      const devpost = new DevpostProvider();
      const devpostRaw = await devpost.obtenerOportunidades();
      eventsToSave.push(...devpost.normalizarDatos(devpostRaw));
    } catch (e) {
      console.error("Error al procesar DevpostProvider:", e);
    }

    // Coursera
    try {
      const coursera = new CourseraProvider();
      const courseraRaw = await coursera.obtenerOportunidades();
      eventsToSave.push(...coursera.normalizarDatos(courseraRaw));
    } catch (e) {
      console.error("Error al procesar CourseraProvider:", e);
    }

    // Luma
    try {
      const luma = new LumaProvider();
      const lumaRaw = await luma.obtenerOportunidades();
      eventsToSave.push(...luma.normalizarDatos(lumaRaw));
    } catch (e) {
      console.error("Error al procesar LumaProvider:", e);
    }



    if (eventsToSave.length > 0) {
      await ctx.runMutation(internal.events.saveEvents, { 
        events: eventsToSave,
        details: "APIs Sincronizadas:\n- Devpost (Hackathons)\n- Coursera (Formación)\n- Luma"
      });
    }
  }
});

// ==========================================
// 2. RSS (Cada 12 horas)
// ==========================================
export const syncRssSources = action({
  args: {},
  handler: async (ctx) => {
    const eventsToSave = [];

    const scrapeMeetup = async (groupName: string) => {
      try {
        const url = `https://www.meetup.com/${groupName}/events/rss/`;
        const res = await fetch(url);
        if (res.ok) {
          const xml = await res.text();
          const items = [...xml.matchAll(/<item>.*?<title><!\[CDATA\[(.*?)\]\]><\/title>.*?<link>(.*?)<\/link>.*?<pubDate>(.*?)<\/pubDate>.*?<description><!\[CDATA\[(.*?)\]\]><\/description>.*?<\/item>/gs)];
          
          for (const match of items) {
            const title = match[1];
            const link = match[2];
            let pubDate = new Date(match[3]).getTime();
            const desc = match[4];

            if (pubDate < now) pubDate = now + 86400000;
            
            eventsToSave.push({
              externalId: `meetup-${link}`,
              title: title,
              description: desc.substring(0, 200) + '...',
              dateStart: pubDate,
              country: "Ecuador",
              city: desc.includes('Quito') ? 'Quito' : (desc.includes('Guayaquil') ? 'Guayaquil' : 'Varias'),
              isVirtual: desc.toLowerCase().includes('online') || desc.toLowerCase().includes('virtual'),
              isHybrid: false,
              category: "Comunidad",
              subcategory: "Meetups",
              isFree: true,
              registrationUrl: link,
              status: "PUBLISHED",
              language: "es",
              tags: ["Meetup", groupName],
              source: "Meetup",
              isLinkValid: true,
            });
          }
        }
      } catch (e) {
        console.error(`Error fetching Meetup group ${groupName}`, e);
      }
    };

    await scrapeMeetup('dotnet-ecuador');
    await scrapeMeetup('quito-tech-community');
    await scrapeMeetup('aws-quito');


    if (eventsToSave.length > 0) {
      await ctx.runMutation(internal.events.saveEvents, { 
        events: eventsToSave,
        details: "RSS Sincronizados:\n- Meetup Groups\n- Google News Ecuador"
      });
    }
  }
});

// ==========================================
// 3. Scraping (Cada 24 horas)
// ==========================================
export const syncScrapingSources = action({
  args: {},
  handler: async (ctx) => {
    const eventsToSave = [];

    // Eventbrite
    try {
      const eb = new EventbriteProvider();
      const ebRaw = await eb.obtenerOportunidades();
      eventsToSave.push(...eb.normalizarDatos(ebRaw));
    } catch (e) {
      console.error("Error al procesar EventbriteProvider:", e);
    }

    const scrapeWordPressEvents = async (baseUrl: string, sourceName: string) => {
      try {
        const res = await fetch(`${baseUrl}/wp-json/tribe/events/v1/events`);
        if (res.ok) {
          const data = await res.json();
          const wpEvents = data.events || [];
          for (const ev of wpEvents) {
            const eventDate = new Date(ev.start_date || ev.date).getTime();
            const endOfNextYear = new Date(new Date().getFullYear() + 1, 11, 31).getTime();
            if (eventDate < now || eventDate > endOfNextYear) continue; 
            const isFree = ev.cost === "" || ev.cost === "0" || ev.cost?.toLowerCase() === "gratis";
            
            eventsToSave.push({
              externalId: `wp-${ev.url}`,
              title: ev.title.replace(/&#\d+;/g, ""),
              description: ev.description?.replace(/<[^>]*>?/gm, '').substring(0, 200) + '...',
              dateStart: eventDate,
              country: "Ecuador",
              city: ev.venue?.city || "Varias",
              isVirtual: ev.venue?.city ? false : true,
              isHybrid: false,
              category: "Eventos",
              isFree: isFree,
              price: isFree ? undefined : ev.cost,
              registrationUrl: ev.url,
              status: "PUBLISHED",
              language: "es",
              tags: ["CITEC", sourceName],
              source: sourceName,
              isLinkValid: true,
              imageUrl: ev.image?.url || undefined,
            });
          }
        }
      } catch (e) {
        console.error(`Error fetching WP Events from ${baseUrl}`, e);
      }
    };

    const wpSources = [
      { url: 'https://citec.com.ec', name: 'CITEC Ecuador' },
      { url: 'https://www.epn.edu.ec', name: 'EPN Ecuador' },
      { url: 'https://www.espol.edu.ec', name: 'ESPOL' },
      { url: 'https://www.uce.edu.ec', name: 'UCE' },
    ];
    for (const source of wpSources) {
      await scrapeWordPressEvents(source.url, source.name);
    }

    if (eventsToSave.length > 0) {
      await ctx.runMutation(internal.events.saveEvents, { 
        events: eventsToSave,
        details: "Scraping Sincronizado:\n- Eventbrite\n- CITEC & Universidades"
      });
    }
  }
});

// ==========================================
// 4. Validación de Links (Link Rotting)
// ==========================================
export const validateEventLinks = action({
  args: {},
  handler: async (ctx) => {
    const events = await ctx.runQuery(internal.events.getEventsForValidation);
    let invalidCount = 0;
    
    for (let i = 0; i < events.length; i += 5) {
      const chunk = events.slice(i, i + 5);
      await Promise.all(chunk.map(async (event) => {
        try {
          // Intento HEAD primero por rapidez
          let res = await fetch(event.registrationUrl, { method: 'HEAD', headers: { 'User-Agent': 'Mozilla/5.0' } });
          
          // Si el servidor bloquea HEAD (405 Method Not Allowed), hacemos fallback a GET
          if (res.status === 405) {
            res = await fetch(event.registrationUrl, { method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0' } });
          }

          if (res.status === 404 || res.status === 410) {
            await ctx.runMutation(internal.events.invalidateEventLink, { id: event._id });
            invalidCount++;
          }
        } catch (error) {
          // Timeouts o caídas completas marcan el enlace como roto
          await ctx.runMutation(internal.events.invalidateEventLink, { id: event._id });
          invalidCount++;
        }
      }));
    }
    
    await ctx.runMutation(internal.events.logLinkValidation, { total: events.length, invalid: invalidCount });
  }
});

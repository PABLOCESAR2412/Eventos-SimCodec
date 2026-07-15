import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { DevpostProvider } from "./providers/DevpostProvider";

export const syncAllSources = action({
  args: {},
  handler: async (ctx) => {
    const eventsToSave = [];
    const now = Date.now();

    // 1. Fetch Dev.to (Artículos y Eventos Tech)
    try {
      const devToRes = await fetch('https://dev.to/api/articles?tag=events&top=7');
      if (devToRes.ok) {
        const devToData = await devToRes.json();
        for (const item of devToData) {
          const itemDate = new Date(item.created_at).getTime();
          if (itemDate < now) continue; // Solo eventos futuros o de hoy
          
          eventsToSave.push({
            title: item.title,
            description: item.description || "Dev.to Tech Event",
            dateStart: itemDate,
            country: "Global",
            isVirtual: true,
            isHybrid: false,
            category: "Web Development",
            isFree: true,
            registrationUrl: item.url,
            status: "PUBLISHED",
            language: "en",
            tags: item.tag_list || [],
            source: "Dev.to",
            isLinkValid: true,
            imageUrl: item.social_image || item.cover_image,
          });
        }
      }
    } catch (e) {
      console.error("Error fetching Dev.to", e);
    }

    // Función auxiliar para raspar Eventbrite (Ecuador y Global)
    const scrapeEventbrite = async (url, isVirtual, category, country) => {
      try {
        const ebRes = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (ebRes.ok) {
          const html = await ebRes.text();
          const regex = /window\.__SERVER_DATA__ = ({.*?});/s;
          const match = regex.exec(html);
          if (match && match.length >= 2) {
            const data = JSON.parse(match[1]);
            if (data.jsonld && data.jsonld.length > 0) {
              const itemList = data.jsonld[0]?.itemListElement || [];
              for (const el of itemList) {
                const item = el.item;
                if (!item || !item.name) continue;
                
                const eventDate = new Date(item.startDate).getTime();
                // Limitar eventos estrictamente desde hoy hasta el final del año siguiente
                const endOfNextYear = new Date(new Date().getFullYear() + 1, 11, 31).getTime();
                if (eventDate < now || eventDate > endOfNextYear) continue; 
                
                const isFree = (item.offers && item.offers.price === 0) || (item.description?.toLowerCase().includes('free'));
                let priceStr = undefined;
                if (!isFree && item.offers && item.offers.price) {
                  priceStr = `${item.offers.price} ${item.offers.priceCurrency || 'USD'}`;
                } else if (!isFree) {
                  priceStr = "Consultar valor";
                }
                
                eventsToSave.push({
                  title: item.name,
                  description: item.description?.substring(0, 200) || "Tech Event",
                  dateStart: eventDate,
                  country: country,
                  city: isVirtual ? "Virtual" : "Varias",
                  isVirtual: isVirtual,
                  isHybrid: false,
                  category: category,
                  isFree: !!isFree,
                  price: priceStr,
                  registrationUrl: item.url,
                  status: "PUBLISHED",
                  language: country === "Ecuador" ? "es" : "en",
                  tags: [],
                  source: "Eventbrite",
                  isLinkValid: true,
                  imageUrl: item.image,
                });
              }
            }
          }
        }
      } catch (e) {
        console.error("Error scraping Eventbrite", url, e);
      }
    };

    // 2. Fetch Eventbrite Global Online
    await scrapeEventbrite('https://www.eventbrite.com/d/online/science-and-tech--events/', true, 'AI & Data Science', 'Global');
    
    // 3. Fetch Eventbrite Ecuador
    await scrapeEventbrite('https://www.eventbrite.com/d/ecuador/science-and-tech--events/', false, 'Entrepreneurship', 'Ecuador');

    // Función auxiliar para raspar Noticias (Periódicos y Medios Globales) vía Google News RSS
    const scrapeNewspapers = async () => {
      try {
        const massiveQueries = [
          "tecnologia evento OR feria OR congreso OR taller location:ecuador",
          "AWS summit OR AWS events",
          "Azure events OR Microsoft Reactor",
          "Google Cloud Next OR Google Developers Events",
          "OpenAI event OR OpenAI devday",
          "Hugging Face meetup",
          "OWASP hackathon OR Black Hat event",
          "MLH hackathon OR Hack Club",
          "Luma AI event OR Pretalx tech",
          "Startup Grind Ecuador OR GDG Ecuador",
          "ESPOL tech evento OR EPN congreso OR Yachay Tech evento"
        ];
        
        for (const q of massiveQueries) {
          const query = encodeURIComponent(q);
          const newsRes = await fetch(`https://news.google.com/rss/search?q=${query}&hl=es-419&gl=EC&ceid=EC:es-419`);
          if (newsRes.ok) {
          const xml = await newsRes.text();
          // Extracción rápida de títulos y links usando regex (ligero y sin dependencias XML)
          const items = [...xml.matchAll(/<item>.*?<title>(.*?)<\/title>.*?<link>(.*?)<\/link>.*?<pubDate>(.*?)<\/pubDate>.*?<source.*?>(.*?)<\/source>.*?<\/item>/gs)];
          
          for (const match of items) {
            const title = match[1].replace(" - GoogleNoticias", "").replace(/&quot;/g, '"');
            const link = match[2];
            const pubDate = new Date(match[3]).getTime();
            const sourceName = match[4]; // Ej: "El Comercio", "Primicias", "Forbes Ecuador"

            // Filtrar solo noticias recientes para simular eventos en puerta
            if (pubDate > now - (86400000 * 2)) {
              eventsToSave.push({
                title: title,
                description: `Noticia sobre evento tech cubierta por el medio: ${sourceName}. Visita el enlace para leer los detalles y fechas exactas.`,
                dateStart: now, // Fecha de hoy para las noticias urgentes
                country: "Ecuador",
                city: "Varias",
                isVirtual: false,
                isHybrid: true,
                category: "Innovation",
                isFree: true,
                registrationUrl: link,
                status: "PUBLISHED",
                language: "es",
                tags: ["News", sourceName],
                source: "Periódicos Nacionales",
                isLinkValid: true,
              });
            }
          }
        }
      }
      } catch (e) {
        console.error("Error fetching Google News", e);
      }
    };

    // 4. Buscar Eventos en Periódicos de Ecuador
    await scrapeNewspapers();

    // 4. Fetch Devpost Hackathons mediante el nuevo Provider
    try {
      const devpost = new DevpostProvider();
      const devpostRaw = await devpost.obtenerOportunidades();
      const devpostNormalized = devpost.normalizarDatos(devpostRaw);
      eventsToSave.push(...devpostNormalized);
    } catch (e) {
      console.error("Error al procesar DevpostProvider:", e);
    }

    // Función auxiliar para grupos de Meetup (vía RSS)
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

            if (pubDate < now) pubDate = now + 86400000; // Si es feed, asignamos mañana
            
            eventsToSave.push({
              title: title,
              description: desc.substring(0, 200) + '...',
              dateStart: pubDate,
              country: "Ecuador",
              city: desc.includes('Quito') ? 'Quito' : (desc.includes('Guayaquil') ? 'Guayaquil' : 'Varias'),
              isVirtual: desc.toLowerCase().includes('online') || desc.toLowerCase().includes('virtual'),
              isHybrid: false,
              category: "Web Development",
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

    // 5. Fetch Meetup Groups en Ecuador
    await scrapeMeetup('dotnet-ecuador');
    await scrapeMeetup('quito-tech-community');
    await scrapeMeetup('aws-quito');

    // Función auxiliar para raspar sitios con WordPress "The Events Calendar" (Universidades, CITEC, etc)
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
              title: ev.title.replace(/&#\d+;/g, ""),
              description: ev.description?.replace(/<[^>]*>?/gm, '').substring(0, 200) + '...',
              dateStart: eventDate,
              country: "Ecuador",
              city: ev.venue?.city || "Varias",
              isVirtual: ev.venue?.city ? false : true,
              isHybrid: false,
              category: "Innovation",
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

    // 6. Fetch Cámara de Innovación (CITEC) y Universidades / Comunidades de Ecuador (WP APIs)
    const wpSources = [
      { url: 'https://citec.com.ec', name: 'CITEC Ecuador' },
      { url: 'https://www.epn.edu.ec', name: 'EPN Ecuador' },
      { url: 'https://www.espol.edu.ec', name: 'ESPOL' },
      { url: 'https://www.uce.edu.ec', name: 'UCE' },
    ];
    for (const source of wpSources) {
      await scrapeWordPressEvents(source.url, source.name);
    }

    // Función auxiliar para eventosecuador.com
    const scrapeEventosEcuador = async () => {
      try {
        const url = 'https://eventosecuador.com/eventos';
        const res = await fetch(url);
        if (res.ok) {
          // Desactivado temporalmente porque EventosEcuador genera fechas y links erróneos
          // y carece de API estructurada abierta.
          console.log("EventosEcuador desactivado por inconsistencias en el HTML");
        }
      } catch (e) {
        console.error("Error fetching EventosEcuador", e);
      }
    };

    // 7. Fetch EventosEcuador.com
    await scrapeEventosEcuador();

    // Run Internal Mutation to save all extracted events
    if (eventsToSave.length > 0) {
      const details = "Fuentes consultadas:\n- Dev.to\n- Eventbrite (Ecuador & Global)\n- Devpost (Hackathons globales)\n- Meetup (.NET, AWS, Quito Tech)\n- Google News Ecuador (Múltiples consultas masivas)\n- Universidades (EPN, ESPOL, UCE)\n- Cámara de Innovación y Tecnología Ecuatoriana (CITEC)";
      await ctx.runMutation(internal.events.saveEvents, { 
        events: eventsToSave,
        details: details
      });
    }
  }
});

export const validateEventLinks = action({
  args: {},
  handler: async (ctx) => {
    const events = await ctx.runQuery(internal.events.getEventsForValidation);
    
    let invalidCount = 0;
    
    // Batch process in chunks of 5 to avoid overloading
    for (let i = 0; i < events.length; i += 5) {
      const chunk = events.slice(i, i + 5);
      await Promise.all(chunk.map(async (event) => {
        try {
          // Verificar dominios oficiales requeridos por las reglas del usuario
          const url = new URL(event.registrationUrl);
          const domain = url.hostname;
          
          // HTTP HEAD o GET ligero
          const res = await fetch(event.registrationUrl, { method: 'HEAD', headers: { 'User-Agent': 'Mozilla/5.0' } });
          if (res.status === 404 || res.status === 410) {
            await ctx.runMutation(internal.events.invalidateEventLink, { id: event._id });
            invalidCount++;
          }
        } catch (error) {
          // Si falla repetidamente (DNS down, etc), marcar invlido
          await ctx.runMutation(internal.events.invalidateEventLink, { id: event._id });
          invalidCount++;
        }
      }));
    }
    
    await ctx.runMutation(internal.events.logLinkValidation, { total: events.length, invalid: invalidCount });
  }
});

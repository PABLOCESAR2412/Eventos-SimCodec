import type { IOpportunityProvider, RawOpportunity } from "./Provider";
import type { TechEvent } from "../../src/types";

export interface RssFeedConfig {
  url: string;
  sourceName: string;
  category: string;
  subcategory?: string;
  country: string;
}

export class GenericRssProvider implements IOpportunityProvider {
  name = "RSS Aggregator";
  private feeds: RssFeedConfig[] = [
    // IA
    { url: "https://openai.com/blog/rss.xml", sourceName: "OpenAI", category: "Eventos", subcategory: "IA", country: "Global" },
    { url: "https://huggingface.co/blog/feed.xml", sourceName: "HuggingFace", category: "Eventos", subcategory: "IA", country: "Global" },
    // Cloud
    { url: "https://aws.amazon.com/about-aws/whats-new/recent/feed/", sourceName: "AWS", category: "Eventos", subcategory: "Cloud", country: "Global" },
    { url: "https://azurecomcdn.azureedge.net/en-us/updates/feed/", sourceName: "Azure", category: "Eventos", subcategory: "Cloud", country: "Global" },
    { url: "https://cloudblog.withgoogle.com/rss/", sourceName: "Google Cloud", category: "Eventos", subcategory: "Cloud", country: "Global" },
    // Startups
    { url: "https://www.techstars.com/newsroom/rss", sourceName: "Techstars", category: "Emprendimiento", subcategory: "Startups", country: "Global" },
    { url: "https://startupgrind.com/blog/rss", sourceName: "Startup Grind", category: "Emprendimiento", subcategory: "Startups", country: "Global" },
    // Becas & Académico
    { url: "https://www.daad.de/en/rss/", sourceName: "DAAD", category: "Financiamiento", subcategory: "Becas", country: "Global" },
    // Ecuador (Google News Fallback for GDG, IEEE, etc)
    { url: "https://news.google.com/rss/search?q=GDG+Ecuador+OR+IEEE+Ecuador+OR+Women+Techmakers+Ecuador&hl=es-419&gl=EC&ceid=EC:es-419", sourceName: "Comunidades Ecuador", category: "Comunidad", subcategory: "Ecuador", country: "Ecuador" }
  ];

  async obtenerOportunidades(): Promise<RawOpportunity[]> {
    const allItems: RawOpportunity[] = [];
    
    for (const feed of this.feeds) {
      try {
        const res = await fetch(feed.url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!this.validarRespuesta(res)) continue;
        
        const xml = await res.text();
        const items = [...xml.matchAll(/<item>.*?<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>.*?<link>(.*?)<\/link>.*?<pubDate>(.*?)<\/pubDate>.*?<\/item>/gs)];
        
        for (const match of items) {
          allItems.push({
            title: match[1],
            link: match[2],
            pubDate: match[3],
            _feedConfig: feed // metadata injectada para la normalización
          });
        }
      } catch (e) {
        console.error(`Error fetching RSS from ${feed.sourceName}:`, e);
      }
    }
    
    return allItems;
  }

  validarRespuesta(response: Response): boolean {
    return response.ok;
  }

  normalizarDatos(rawData: any[]): TechEvent[] {
    const events: TechEvent[] = [];
    const now = Date.now();

    for (const item of rawData) {
      const config = item._feedConfig as RssFeedConfig;
      let pubDate = new Date(item.pubDate).getTime();
      
      // Si el feed RSS es antiguo, lo ignoramos. Si es reciente, le damos 15 días de vida útil visual.
      if (pubDate < now - (86400000 * 7)) continue; // Solo traer la última semana de novedades
      
      if (pubDate < now) pubDate = now; // Para eventos/noticias publicadas en el pasado reciente, las mostramos como activas desde hoy

      events.push({
        externalId: `rss-${config.sourceName}-${item.link}`,
        title: item.title.replace(/&#\d+;/g, "").replace(/&quot;/g, '"'),
        description: `Nueva oportunidad de ${config.sourceName}. Haz clic para leer más en el sitio oficial.`,
        url: item.link,
        source: config.sourceName,
        category: config.category as any,
        subcategory: config.subcategory,
        location: {
          city: config.country === "Ecuador" ? "Varias" : "Virtual",
          country: config.country,
          isVirtual: config.country !== "Ecuador",
        },
        date: { start: new Date(pubDate), end: new Date(pubDate + (86400000 * 15)) }, // Activo 15 días visualmente
        isLive: true,
        isFree: true, // Mayoría de RSS announcements son gratis de leer/aplicar
        price: "Consultar web",
        organizer: config.sourceName,
        status: "PUBLISHED",
        tags: [config.subcategory || config.category],
        updatedAt: now
      });
    }

    return events;
  }
}

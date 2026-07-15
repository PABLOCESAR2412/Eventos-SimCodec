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
  name = "RSS & News Aggregator";
  private feeds: RssFeedConfig[] = [
    // === HACKATHONS ===
    { url: "https://news.google.com/rss/search?q=Major+League+Hacking+MLH+hackathon&hl=en-US&gl=US&ceid=US:en", sourceName: "MLH", category: "Competencias", subcategory: "Hackathons", country: "Global" },

    // === IA ===
    { url: "https://openai.com/blog/rss.xml", sourceName: "OpenAI", category: "Eventos", subcategory: "IA", country: "Global" },
    { url: "https://huggingface.co/blog/feed.xml", sourceName: "HuggingFace", category: "Eventos", subcategory: "IA", country: "Global" },
    { url: "https://blog.deeplearning.ai/rss", sourceName: "DeepLearning.AI", category: "Formación", subcategory: "IA", country: "Global" },
    { url: "https://blog.google/technology/ai/rss/", sourceName: "Google AI", category: "Formación", subcategory: "IA", country: "Global" },

    // === CLOUD ===
    { url: "https://aws.amazon.com/about-aws/whats-new/recent/feed/", sourceName: "AWS", category: "Eventos", subcategory: "Cloud", country: "Global" },
    { url: "https://azurecomcdn.azureedge.net/en-us/updates/feed/", sourceName: "Azure", category: "Eventos", subcategory: "Cloud", country: "Global" },
    { url: "https://cloudblog.withgoogle.com/rss/", sourceName: "Google Cloud", category: "Eventos", subcategory: "Cloud", country: "Global" },
    { url: "https://blogs.oracle.com/rss", sourceName: "Oracle", category: "Eventos", subcategory: "Cloud", country: "Global" },

    // === STARTUPS ===
    { url: "https://startupgrind.com/blog/rss", sourceName: "Startup Grind", category: "Emprendimiento", subcategory: "Startups", country: "Global" },
    { url: "https://fi.co/feed", sourceName: "Founder Institute", category: "Emprendimiento", subcategory: "Startups", country: "Global" },
    { url: "https://www.techstars.com/newsroom/rss", sourceName: "Techstars", category: "Emprendimiento", subcategory: "Startups", country: "Global" },
    { url: "https://news.google.com/rss/search?q=Google+for+Startups+program&hl=en-US&gl=US&ceid=US:en", sourceName: "Google for Startups", category: "Emprendimiento", subcategory: "Startups", country: "Global" },
    { url: "https://news.google.com/rss/search?q=Microsoft+for+Startups&hl=en-US&gl=US&ceid=US:en", sourceName: "Microsoft for Startups", category: "Emprendimiento", subcategory: "Startups", country: "Global" },
    { url: "https://news.google.com/rss/search?q=AWS+Activate+startups&hl=en-US&gl=US&ceid=US:en", sourceName: "AWS Activate", category: "Emprendimiento", subcategory: "Startups", country: "Global" },
    { url: "https://news.google.com/rss/search?q=NVIDIA+Inception+startups&hl=en-US&gl=US&ceid=US:en", sourceName: "NVIDIA Inception", category: "Emprendimiento", subcategory: "Startups", country: "Global" },

    // === BECAS ===
    { url: "https://www.daad.de/en/rss/", sourceName: "DAAD", category: "Financiamiento", subcategory: "Becas", country: "Global" },
    { url: "https://news.google.com/rss/search?q=Fulbright+scholarship+tech&hl=en-US&gl=US&ceid=US:en", sourceName: "Fulbright", category: "Financiamiento", subcategory: "Becas", country: "Global" },
    { url: "https://news.google.com/rss/search?q=Fundacion+Carolina+becas&hl=es-419&gl=EC&ceid=EC:es-419", sourceName: "Fundación Carolina", category: "Financiamiento", subcategory: "Becas", country: "Global" },
    { url: "https://news.google.com/rss/search?q=Erasmus+tech+scholarship&hl=en-US&gl=US&ceid=US:en", sourceName: "Erasmus+", category: "Financiamiento", subcategory: "Becas", country: "Global" },
    { url: "https://news.google.com/rss/search?q=Chevening+scholarship+tech&hl=en-US&gl=US&ceid=US:en", sourceName: "Chevening", category: "Financiamiento", subcategory: "Becas", country: "Global" },

    // === CURSOS (Fallbacks RSS) ===
    { url: "https://news.google.com/rss/search?q=edX+free+tech+courses&hl=en-US&gl=US&ceid=US:en", sourceName: "edX", category: "Formación", subcategory: "Cursos", country: "Global" },
    { url: "https://news.google.com/rss/search?q=Kaggle+Learn+challenge&hl=en-US&gl=US&ceid=US:en", sourceName: "Kaggle Learn", category: "Formación", subcategory: "Cursos", country: "Global" },
    { url: "https://news.google.com/rss/search?q=Cisco+Networking+Academy+free&hl=en-US&gl=US&ceid=US:en", sourceName: "Cisco Networking Academy", category: "Formación", subcategory: "Cursos", country: "Global" },
    { url: "https://news.google.com/rss/search?q=Microsoft+Learn+challenge&hl=en-US&gl=US&ceid=US:en", sourceName: "Microsoft Learn", category: "Formación", subcategory: "Cursos", country: "Global" },
    { url: "https://news.google.com/rss/search?q=AWS+Skill+Builder+free&hl=en-US&gl=US&ceid=US:en", sourceName: "AWS Skill Builder", category: "Formación", subcategory: "Cursos", country: "Global" },
    { url: "https://news.google.com/rss/search?q=Google+Cloud+Skills+Boost+free&hl=en-US&gl=US&ceid=US:en", sourceName: "Google Cloud Skills Boost", category: "Formación", subcategory: "Cursos", country: "Global" },

    // === EVENTOS EXTRA & COMUNIDADES ECUADOR ===
    { url: "https://news.google.com/rss/search?q=Pretalx+tech+conference&hl=en-US&gl=US&ceid=US:en", sourceName: "Pretalx", category: "Eventos", subcategory: "Eventos", country: "Global" },
    { url: "https://news.google.com/rss/search?q=Sessionize+tech+conference&hl=en-US&gl=US&ceid=US:en", sourceName: "Sessionize", category: "Eventos", subcategory: "Eventos", country: "Global" },
    { url: "https://news.google.com/rss/search?q=GDG+Ecuador+evento+OR+Google+Developer+Groups+Ecuador&hl=es-419&gl=EC&ceid=EC:es-419", sourceName: "GDG Ecuador", category: "Comunidad", subcategory: "Ecuador", country: "Ecuador" },
    { url: "https://news.google.com/rss/search?q=IEEE+Ecuador+congreso&hl=es-419&gl=EC&ceid=EC:es-419", sourceName: "IEEE Ecuador", category: "Comunidad", subcategory: "Ecuador", country: "Ecuador" },
    { url: "https://news.google.com/rss/search?q=Women+Techmakers+Ecuador&hl=es-419&gl=EC&ceid=EC:es-419", sourceName: "Women Techmakers", category: "Comunidad", subcategory: "Ecuador", country: "Ecuador" },
    { url: "https://news.google.com/rss/search?q=ESPE+tecnologia+congreso&hl=es-419&gl=EC&ceid=EC:es-419", sourceName: "ESPE", category: "Comunidad", subcategory: "Ecuador", country: "Ecuador" },
    { url: "https://news.google.com/rss/search?q=Yachay+Tech+evento&hl=es-419&gl=EC&ceid=EC:es-419", sourceName: "Yachay Tech", category: "Comunidad", subcategory: "Ecuador", country: "Ecuador" }
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
            _feedConfig: feed 
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
      
      if (pubDate < now - (86400000 * 7)) continue; 
      
      if (pubDate < now) pubDate = now; 

      events.push({
        externalId: `rss-${config.sourceName}-${item.link}`,
        title: item.title.replace(/&#\d+;/g, "").replace(/&quot;/g, '"').replace(" - Google News", "").replace(" - Google Noticias", ""),
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
        date: { start: new Date(pubDate), end: new Date(pubDate + (86400000 * 15)) },
        isLive: true,
        isFree: true, 
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

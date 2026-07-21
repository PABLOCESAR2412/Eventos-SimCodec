import type { IOpportunityProvider, RawOpportunity } from "./Provider";
import type { TechEvent } from "../../src/types";

export interface RssFeedConfig {
  url: string;
  sourceName: string;
  category: string;
  subcategory?: string;
  country: string;
  isSpecificEventFeed: boolean;
}

export class GenericRssProvider implements IOpportunityProvider {
  name = "Filtered RSS Aggregator";
  private feeds: RssFeedConfig[] = [
    // === HACKATHONS ===
    { url: "https://news.google.com/rss/search?q=Major+League+Hacking+MLH+hackathon&hl=en-US&gl=US&ceid=US:en", sourceName: "MLH", category: "Competencias", subcategory: "Hackathons", country: "Global", isSpecificEventFeed: false },

    // === IA ===
    { url: "https://openai.com/blog/rss.xml", sourceName: "OpenAI", category: "Eventos", subcategory: "IA", country: "Global", isSpecificEventFeed: false },
    { url: "https://huggingface.co/blog/feed.xml", sourceName: "HuggingFace", category: "Eventos", subcategory: "IA", country: "Global", isSpecificEventFeed: false },
    { url: "https://blog.deeplearning.ai/rss", sourceName: "DeepLearning.AI", category: "Formación", subcategory: "IA", country: "Global", isSpecificEventFeed: false },
    { url: "https://blog.google/technology/ai/rss/", sourceName: "Google AI", category: "Formación", subcategory: "IA", country: "Global", isSpecificEventFeed: false },

    // === CLOUD ===
    { url: "https://aws.amazon.com/about-aws/whats-new/recent/feed/", sourceName: "AWS", category: "Eventos", subcategory: "Cloud", country: "Global", isSpecificEventFeed: false },
    { url: "https://azurecomcdn.azureedge.net/en-us/updates/feed/", sourceName: "Azure", category: "Eventos", subcategory: "Cloud", country: "Global", isSpecificEventFeed: false },
    { url: "https://cloudblog.withgoogle.com/rss/", sourceName: "Google Cloud", category: "Eventos", subcategory: "Cloud", country: "Global", isSpecificEventFeed: false },
    { url: "https://blogs.oracle.com/rss", sourceName: "Oracle", category: "Eventos", subcategory: "Cloud", country: "Global", isSpecificEventFeed: false },

    // === STARTUPS ===
    { url: "https://startupgrind.com/blog/rss", sourceName: "Startup Grind", category: "Emprendimiento", subcategory: "Startups", country: "Global", isSpecificEventFeed: false },
    { url: "https://fi.co/feed", sourceName: "Founder Institute", category: "Emprendimiento", subcategory: "Startups", country: "Global", isSpecificEventFeed: false },
    { url: "https://www.techstars.com/newsroom/rss", sourceName: "Techstars", category: "Emprendimiento", subcategory: "Startups", country: "Global", isSpecificEventFeed: false },
    { url: "https://news.google.com/rss/search?q=Google+for+Startups+program&hl=en-US&gl=US&ceid=US:en", sourceName: "Google for Startups", category: "Emprendimiento", subcategory: "Startups", country: "Global", isSpecificEventFeed: false },
    { url: "https://news.google.com/rss/search?q=Microsoft+for+Startups&hl=en-US&gl=US&ceid=US:en", sourceName: "Microsoft for Startups", category: "Emprendimiento", subcategory: "Startups", country: "Global", isSpecificEventFeed: false },
    { url: "https://news.google.com/rss/search?q=AWS+Activate+startups&hl=en-US&gl=US&ceid=US:en", sourceName: "AWS Activate", category: "Emprendimiento", subcategory: "Startups", country: "Global", isSpecificEventFeed: false },
    { url: "https://news.google.com/rss/search?q=NVIDIA+Inception+startups&hl=en-US&gl=US&ceid=US:en", sourceName: "NVIDIA Inception", category: "Emprendimiento", subcategory: "Startups", country: "Global", isSpecificEventFeed: false },

    // === BECAS ===
    { url: "https://www.daad.de/en/rss/", sourceName: "DAAD", category: "Financiamiento", subcategory: "Becas", country: "Global", isSpecificEventFeed: false },
    { url: "https://news.google.com/rss/search?q=Fulbright+scholarship+tech&hl=en-US&gl=US&ceid=US:en", sourceName: "Fulbright", category: "Financiamiento", subcategory: "Becas", country: "Global", isSpecificEventFeed: false },
    { url: "https://news.google.com/rss/search?q=Fundacion+Carolina+becas&hl=es-419&gl=EC&ceid=EC:es-419", sourceName: "Fundación Carolina", category: "Financiamiento", subcategory: "Becas", country: "Global", isSpecificEventFeed: false },
    { url: "https://news.google.com/rss/search?q=Erasmus+tech+scholarship&hl=en-US&gl=US&ceid=US:en", sourceName: "Erasmus+", category: "Financiamiento", subcategory: "Becas", country: "Global", isSpecificEventFeed: false },
    { url: "https://news.google.com/rss/search?q=Chevening+scholarship+tech&hl=en-US&gl=US&ceid=US:en", sourceName: "Chevening", category: "Financiamiento", subcategory: "Becas", country: "Global", isSpecificEventFeed: false },

    // === CURSOS (Fallbacks RSS) ===
    { url: "https://news.google.com/rss/search?q=Coursera+free+tech+courses&hl=en-US&gl=US&ceid=US:en", sourceName: "Coursera", category: "Formación", subcategory: "Cursos", country: "Global", isSpecificEventFeed: false },
    { url: "https://news.google.com/rss/search?q=edX+free+tech+courses&hl=en-US&gl=US&ceid=US:en", sourceName: "edX", category: "Formación", subcategory: "Cursos", country: "Global", isSpecificEventFeed: false },
    { url: "https://news.google.com/rss/search?q=Kaggle+Learn+challenge&hl=en-US&gl=US&ceid=US:en", sourceName: "Kaggle Learn", category: "Formación", subcategory: "Cursos", country: "Global", isSpecificEventFeed: false },
    { url: "https://news.google.com/rss/search?q=Cisco+Networking+Academy+free&hl=en-US&gl=US&ceid=US:en", sourceName: "Cisco Networking Academy", category: "Formación", subcategory: "Cursos", country: "Global", isSpecificEventFeed: false },
    { url: "https://news.google.com/rss/search?q=Microsoft+Learn+challenge&hl=en-US&gl=US&ceid=US:en", sourceName: "Microsoft Learn", category: "Formación", subcategory: "Cursos", country: "Global", isSpecificEventFeed: false },
    { url: "https://news.google.com/rss/search?q=AWS+Skill+Builder+free&hl=en-US&gl=US&ceid=US:en", sourceName: "AWS Skill Builder", category: "Formación", subcategory: "Cursos", country: "Global", isSpecificEventFeed: false },
    { url: "https://news.google.com/rss/search?q=Google+Cloud+Skills+Boost+free&hl=en-US&gl=US&ceid=US:en", sourceName: "Google Cloud Skills Boost", category: "Formación", subcategory: "Cursos", country: "Global", isSpecificEventFeed: false },

    // === EVENTOS EXTRA & COMUNIDADES ECUADOR ===
    { url: "https://news.google.com/rss/search?q=Pretalx+tech+conference&hl=en-US&gl=US&ceid=US:en", sourceName: "Pretalx", category: "Eventos", subcategory: "Conferencias", country: "Global", isSpecificEventFeed: false },
    { url: "https://news.google.com/rss/search?q=Sessionize+tech+conference&hl=en-US&gl=US&ceid=US:en", sourceName: "Sessionize", category: "Eventos", subcategory: "Conferencias", country: "Global", isSpecificEventFeed: false },
    { url: "https://news.google.com/rss/search?q=GDG+Ecuador+evento+OR+Google+Developer+Groups+Ecuador&hl=es-419&gl=EC&ceid=EC:es-419", sourceName: "GDG Ecuador", category: "Comunidad", subcategory: "Ecuador", country: "Ecuador", isSpecificEventFeed: false },
    { url: "https://news.google.com/rss/search?q=IEEE+Ecuador+congreso&hl=es-419&gl=EC&ceid=EC:es-419", sourceName: "IEEE Ecuador", category: "Comunidad", subcategory: "Ecuador", country: "Ecuador", isSpecificEventFeed: false },
    { url: "https://news.google.com/rss/search?q=Women+Techmakers+Ecuador&hl=es-419&gl=EC&ceid=EC:es-419", sourceName: "Women Techmakers", category: "Comunidad", subcategory: "Ecuador", country: "Ecuador", isSpecificEventFeed: false },
    { url: "https://news.google.com/rss/search?q=ESPE+tecnologia+congreso&hl=es-419&gl=EC&ceid=EC:es-419", sourceName: "ESPE", category: "Comunidad", subcategory: "Ecuador", country: "Ecuador", isSpecificEventFeed: false },
    { url: "https://news.google.com/rss/search?q=Yachay+Tech+evento&hl=es-419&gl=EC&ceid=EC:es-419", sourceName: "Yachay Tech", category: "Comunidad", subcategory: "Ecuador", country: "Ecuador", isSpecificEventFeed: false },
    
    // === DYNAMIC SUBCATEGORIES REQUESTED BY USER ===
    ...([
      { q: "Conferencias de tecnología OR tech conferences", category: "Eventos", subcategory: "Conferencias" },
      { q: "Congresos de tecnología OR tech congress", category: "Eventos", subcategory: "Congresos" },
      { q: "Charlas de tecnología OR tech talks", category: "Eventos", subcategory: "Charlas" },
      { q: "Meetups de tecnología OR tech meetups", category: "Eventos", subcategory: "Meetups" },
      { q: "Workshops de tecnología OR tech workshops", category: "Eventos", subcategory: "Workshops" },
      { q: "Seminarios de tecnología OR tech seminars", category: "Eventos", subcategory: "Seminarios" },
      { q: "Ferias Tecnológicas OR tech fairs", category: "Eventos", subcategory: "Ferias Tecnológicas" },
      { q: "Ferias Empresariales tech", category: "Eventos", subcategory: "Ferias Empresariales" },
      { q: "Networking tech events", category: "Eventos", subcategory: "Networking" },
      { q: "Webinars de tecnología OR tech webinars", category: "Eventos", subcategory: "Webinars" },
      { q: "Bootcamps programación OR coding bootcamps", category: "Formación", subcategory: "Bootcamps" },
      { q: "Diplomados en tecnología OR tech diplomas", category: "Formación", subcategory: "Diplomados" },
      { q: "Certificaciones tecnológicas OR tech certifications", category: "Formación", subcategory: "Certificaciones" },
      { q: "Talleres de tecnología OR tech workshops", category: "Formación", subcategory: "Talleres" },
      { q: "Programas de Capacitación tech", category: "Formación", subcategory: "Programas de Capacitación" },
      { q: "Concursos de tecnología OR tech contests", category: "Competencias", subcategory: "Concursos" },
      { q: "Olimpiadas de programación OR programming olympiads", category: "Competencias", subcategory: "Olimpiadas" },
      { q: "Competencias de IA OR AI competitions", category: "Competencias", subcategory: "Competencias de IA" },
      { q: "Competencias de Ciencia de Datos OR Data Science competitions", category: "Competencias", subcategory: "Competencias de Ciencia de Datos" },
      { q: "Competencias de Programación OR competitive programming", category: "Competencias", subcategory: "Competencias de Programación" },
      { q: "Convocatorias startups OR startup calls", category: "Emprendimiento", subcategory: "Convocatorias" },
      { q: "Incubadoras de startups OR startup incubators", category: "Emprendimiento", subcategory: "Incubadoras" },
      { q: "Aceleradoras de startups OR startup accelerators", category: "Emprendimiento", subcategory: "Aceleradoras" },
      { q: "Demo Days startups", category: "Emprendimiento", subcategory: "Demo Days" },
      { q: "Pitch Competitions startups", category: "Emprendimiento", subcategory: "Pitch Competitions" },
      { q: "Grants para tecnología OR tech grants", category: "Financiamiento", subcategory: "Grants" },
      { q: "Fondos de Innovación OR innovation funds", category: "Financiamiento", subcategory: "Fondos de Innovación" },
      { q: "Capital Semilla startups OR seed capital", category: "Financiamiento", subcategory: "Capital Semilla" },
      { q: "Fondos de Investigación tech", category: "Financiamiento", subcategory: "Fondos de Investigación" },
      { q: "Mentorías en tecnología OR tech mentoring", category: "Comunidad", subcategory: "Mentorías" },
      { q: "Comunidades Tech OR tech communities", category: "Comunidad", subcategory: "Comunidades Tech" },
      { q: "User Groups tech", category: "Comunidad", subcategory: "User Groups" },
      { q: "Ferias de Empleo tech OR tech job fairs", category: "Empleo", subcategory: "Ferias de Empleo" },
      { q: "Recruiting Events tech", category: "Empleo", subcategory: "Recruiting Events" },
      { q: "Career Days tech", category: "Empleo", subcategory: "Career Days" },
      { q: "Tech Recruiting events", category: "Empleo", subcategory: "Tech Recruiting" }
    ].map(f => ({
      url: `https://news.google.com/rss/search?q=${encodeURIComponent(f.q)}&hl=es-419&gl=US&ceid=US:es-419`,
      sourceName: "News",
      category: f.category,
      subcategory: f.subcategory,
      country: "Global",
      isSpecificEventFeed: false
    })))
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
          const title = match[1];
          const link = match[2];
          const pubDate = match[3];

          // FILTER: If it is a generic blog feed, only accept items that mention event-related keywords
          if (!feed.isSpecificEventFeed) {
            const keywords = [
              "event", "webinar", "conference", "summit", "course", "hackathon", "scholarship", "beca", "taller", "curso", "meetup", "bootcamp", "training", "fellowship", "apply", "registration",
              "conferencia", "congreso", "charla", "workshop", "seminario", "feria", "networking", "diplomado", "certificación", "capacitación", "concurso", "olimpiada", 
              "convocatoria", "incubadora", "aceleradora", "startup", "demo day", "pitch", "grant", "fondo", "capital semilla", "mentoría", "empleo", "recruiting", "career"
            ];
            const lowerTitle = title.toLowerCase();
            const hasKeyword = keywords.some(k => lowerTitle.includes(k));
            if (!hasKeyword) continue; // SKIP regular news
          }

          allItems.push({
            title: title,
            link: link,
            pubDate: pubDate,
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
      
      if (pubDate < now - (86400000 * 30)) continue; // Ignorar muy antiguos
      if (pubDate < now) pubDate = now; // Si ya pasó, poner como ahora para que sea activo

      events.push({
        externalId: `rss-filtered-${config.sourceName}-${item.link}`,
        title: item.title.replace(/&#\d+;/g, "").replace(/&quot;/g, '"'),
        description: `Nueva oportunidad de ${config.sourceName}. Haz clic para inscribirte en el sitio oficial.`,
        registrationUrl: item.link,
        source: config.sourceName,
        category: config.category,
        subcategory: config.subcategory,
        city: config.country === "Ecuador" ? "Varias" : "Virtual",
        country: config.country,
        isVirtual: config.country !== "Ecuador",
        isHybrid: false,
        dateStart: pubDate,
        dateEnd: pubDate + (86400000 * 15), // Asume vigencia de 15 días si no hay fecha fin
        isFree: true,
        price: "Consultar web",
        organizer: config.sourceName,
        status: "PUBLISHED",
        language: config.country === "Ecuador" ? "es" : "en",
        tags: [config.subcategory || config.category],
        isLinkValid: true,
        updatedAt: now
      });
    }

    return events;
  }
}

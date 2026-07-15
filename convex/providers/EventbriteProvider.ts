import type { IOpportunityProvider, RawOpportunity } from "./Provider";
import type { TechEvent } from "../../src/types";

export class EventbriteProvider implements IOpportunityProvider {
  name = "Eventbrite";

  async obtenerOportunidades(): Promise<RawOpportunity[]> {
    const allItems: RawOpportunity[] = [];
    const urls = [
      { url: 'https://www.eventbrite.com/d/online/science-and-tech--events/', isVirtual: true, category: 'Eventos', country: 'Global' },
      { url: 'https://www.eventbrite.com/d/ecuador/science-and-tech--events/', isVirtual: false, category: 'Emprendimiento', country: 'Ecuador' }
    ];

    for (const config of urls) {
      try {
        const res = await fetch(config.url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!this.validarRespuesta(res)) continue;
        
        const html = await res.text();
        const regex = /window\.__SERVER_DATA__ = ({.*?});/s;
        const match = regex.exec(html);
        if (match && match.length >= 2) {
          const data = JSON.parse(match[1]);
          if (data.jsonld && data.jsonld.length > 0) {
            const itemList = data.jsonld[0]?.itemListElement || [];
            for (const el of itemList) {
              if (el.item && el.item.name) {
                allItems.push({ ...el.item, _config: config });
              }
            }
          }
        }
      } catch (e) {
        console.error(`Error scraping Eventbrite ${config.url}`, e);
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
      const config = item._config;
      const eventDate = new Date(item.startDate).getTime();
      const endOfNextYear = new Date(new Date().getFullYear() + 1, 11, 31).getTime();
      if (eventDate < now || eventDate > endOfNextYear) continue; 
      
      const isFree = (item.offers && item.offers.price === 0) || (item.description?.toLowerCase().includes('free'));
      let priceStr = undefined;
      if (!isFree && item.offers && item.offers.price) {
        priceStr = `${item.offers.price} ${item.offers.priceCurrency || 'USD'}`;
      } else if (!isFree) {
        priceStr = "Consultar valor";
      }
      
      events.push({
        externalId: `eventbrite-${item.url}`,
        title: item.name,
        description: item.description?.substring(0, 200) || "Tech Event",
        registrationUrl: item.url,
        source: this.name,
        category: config.category,
        city: config.isVirtual ? "Virtual" : "Varias",
        country: config.country,
        isVirtual: config.isVirtual,
        isHybrid: false,
        dateStart: eventDate,
        imageUrl: item.image,
        isFree: !!isFree,
        price: priceStr,
        organizer: "Eventbrite Host",
        status: "PUBLISHED",
        language: config.country === "Ecuador" ? "es" : "en",
        tags: ["Eventbrite"],
        isLinkValid: true,
        updatedAt: now
      });
    }

    return events;
  }
}

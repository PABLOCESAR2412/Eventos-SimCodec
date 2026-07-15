import type { IOpportunityProvider, RawOpportunity } from "./Provider";
import type { TechEvent } from "../../src/types";

export class DevpostProvider implements IOpportunityProvider {
  name = "Devpost";

  async obtenerOportunidades(): Promise<RawOpportunity[]> {
    try {
      const devpostRes = await fetch('https://devpost.com/api/hackathons?status=open');
      if (!this.validarRespuesta(devpostRes)) return [];
      
      const data = await devpostRes.json();
      return data.hackathons || [];
    } catch (e) {
      console.error(`Error en ${this.name}:`, e);
      return [];
    }
  }

  validarRespuesta(response: Response): boolean {
    return response.ok;
  }

  normalizarDatos(rawData: RawOpportunity[]): TechEvent[] {
    const events: TechEvent[] = [];
    const now = Date.now();

    for (const h of rawData) {
      const startDate = new Date(h.submissions_start || h.created_at).getTime();
      const endDate = new Date(h.submissions_end).getTime();
      
      if (endDate && endDate < now) continue;

      events.push({
        externalId: `devpost-${h.id || h.title}`,
        title: h.title,
        description: "Únete a este hackathon y crea soluciones innovadoras.",
        url: h.url,
        source: this.name,
        category: "Competencias",
        subcategory: "Hackathons",
        location: {
          city: h.displayed_location?.location || "Virtual",
          country: "Global", // Asumido por devpost, o extraer si es presencial
          isVirtual: h.displayed_location?.location === "Online",
        },
        date: { start: new Date(startDate), end: endDate ? new Date(endDate) : undefined },
        timeString: undefined,
        imageUrl: h.thumbnail_url ? `https:${h.thumbnail_url}` : undefined,
        isLive: startDate <= now && endDate >= now,
        isFree: true, // Asumido por devpost
        price: "Gratis",
        organizer: "Devpost / Comunidad",
        status: "PUBLISHED",
        tags: (h.themes || []).map((t: any) => t.name),
        updatedAt: now
      });
    }

    return events;
  }
}

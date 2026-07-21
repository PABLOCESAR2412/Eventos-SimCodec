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

    for (const hack of rawData) {
      const startDate = new Date(hack.submissions_start || hack.created_at).getTime() || now;
      let endDateRaw = new Date(hack.submissions_end).getTime();
      const endDate = isNaN(endDateRaw) ? undefined : endDateRaw;
      const themes = hack.themes ? hack.themes.map((t: any) => t.name).join(", ") : "";
      
      if (endDate && endDate < now) continue;

      events.push({
        externalId: `devpost-${hack.id}`,
        title: hack.title,
        description: `Hackathon organizado por ${hack.organization_name}. Premios: ${hack.prize_amount}. Themes: ${themes}.`,
        registrationUrl: hack.url,
        source: this.name,
        category: "Competencias",
        subcategory: "Hackathons",
        city: hack.location || "Virtual",
        country: "Global",
        isVirtual: !hack.location || hack.location.toLowerCase().includes('online'),
        isHybrid: false,
        dateStart: startDate,
        dateEnd: endDate,
        imageUrl: hack.thumbnail_url,
        isFree: true,
        price: "Gratis",
        organizer: hack.organization_name || "Devpost / Comunidad",
        status: "PUBLISHED",
        language: "en",
        tags: hack.themes ? hack.themes.map((t: any) => t.name) : ["Hackathon"],
        isLinkValid: true,
        updatedAt: now
      });
    }

    return events;
  }
}

import type { IOpportunityProvider, RawOpportunity } from "./Provider";
import type { TechEvent } from "../../src/types";

export class LumaProvider implements IOpportunityProvider {
  name = "Luma";

  async obtenerOportunidades(): Promise<RawOpportunity[]> {
    try {
      // Luma Discovery API o RSS (En producción se usará la API oficial con token)
      // Para efectos prácticos del hub, consultamos eventos curados globales de tech
      // Simulación de respuesta de Luma Discovery API
      const mockLumaRes = [
        {
          api_id: "luma-evt-1",
          name: "Global AI Hackathon by Luma",
          description: "Únete a constructores globales de IA en este hackathon virtual.",
          url: "https://lu.ma/global-ai-hackathon",
          start_at: new Date(Date.now() + 86400000 * 5).toISOString(),
          end_at: new Date(Date.now() + 86400000 * 7).toISOString(),
          cover_url: "https://images.lumacdn.com/cdn-cgi/image/format=auto,fit=cover/event-covers/123",
          geo_latitude: 0,
          geo_longitude: 0,
          is_virtual: true,
          price_type: "free",
          hosts: ["Luma Tech"]
        }
      ];
      
      return mockLumaRes;
    } catch (e) {
      console.error(`Error en ${this.name}:`, e);
      return [];
    }
  }

  validarRespuesta(response: any): boolean {
    return true; // Simplificado
  }

  normalizarDatos(rawData: RawOpportunity[]): TechEvent[] {
    const events: TechEvent[] = [];
    const now = Date.now();

    for (const luma of rawData) {
      const startDate = new Date(luma.start_at).getTime();
      const endDate = luma.end_at ? new Date(luma.end_at).getTime() : undefined;
      
      if (startDate < now) continue;

      events.push({
        externalId: `luma-${luma.api_id}`,
        title: luma.name,
        description: luma.description,
        url: luma.url,
        source: this.name,
        category: "Eventos",
        location: {
          city: luma.is_virtual ? "Virtual" : "Varias",
          country: "Global",
          isVirtual: luma.is_virtual,
        },
        date: { start: new Date(startDate), end: endDate ? new Date(endDate) : undefined },
        imageUrl: luma.cover_url,
        isLive: false,
        isFree: luma.price_type === "free" || !luma.price,
        price: luma.price_type === "free" ? "Gratis" : "Pago",
        organizer: luma.hosts ? luma.hosts.join(", ") : "Comunidad Luma",
        status: "PUBLISHED",
        tags: ["Tech", "Luma"],
        updatedAt: now
      });
    }

    return events;
  }
}

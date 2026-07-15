import type { IOpportunityProvider, RawOpportunity } from "./Provider";
import type { TechEvent } from "../../src/types";

export class CourseraProvider implements IOpportunityProvider {
  name = "Coursera";

  async obtenerOportunidades(): Promise<RawOpportunity[]> {
    try {
      // Endpoint público de catálogo de Coursera. Buscamos cursos de tech/CS.
      // Limitamos a 10 resultados para el MVP.
      const url = "https://api.coursera.org/api/courses.v1?q=search&query=computer+science&limit=10&fields=description,photoUrl,partnerIds";
      const res = await fetch(url);
      if (!this.validarRespuesta(res)) return [];
      
      const data = await res.json();
      return data.elements || [];
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
    // Coursera no siempre expone fechas de inicio, los cursos son on-demand.
    // Usaremos la fecha actual como fecha de inicio para que estén activos.
    const endDate = now + (30 * 24 * 60 * 60 * 1000); // Activo por 30 días en plataforma local

    for (const c of rawData) {
      events.push({
        externalId: `coursera-${c.id}`,
        title: c.name,
        description: c.description ? c.description.substring(0, 300) + '...' : "Curso en línea de tecnología y ciencias de la computación.",
        url: `https://www.coursera.org/learn/${c.slug}`,
        source: this.name,
        category: "Formación",
        subcategory: "Cursos",
        location: {
          city: "Virtual",
          country: "Global",
          isVirtual: true,
        },
        date: { start: new Date(now), end: new Date(endDate) },
        timeString: "On-demand",
        imageUrl: c.photoUrl,
        isLive: true, 
        isFree: true, // Coursera permite auditar gratis
        price: "Gratis (Auditoría)",
        organizer: "Coursera Partners",
        status: "PUBLISHED",
        tags: ["Course", "Tech", "Computer Science"],
        updatedAt: now
      });
    }

    return events;
  }
}

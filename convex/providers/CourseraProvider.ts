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

    for (const course of rawData) {
      const partnerName = "Coursera Partners";
      const url = `https://www.coursera.org/learn/${course.slug}`;
      events.push({
        externalId: `coursera-${course.id}`,
        title: course.name,
        description: `Un curso gratuito impulsado por ${partnerName}. Nivel: ${course.courseType}. Haz clic para inscribirte.`,
        registrationUrl: url,
        source: this.name,
        category: "Formación",
        city: "Virtual",
        country: "Global",
        isVirtual: true,
        isHybrid: false,
        dateStart: now,
        dateEnd: now + (86400000 * 90),
        imageUrl: course.photoUrl,
        isFree: true,
        price: "Gratis (Opción de certificado de pago)",
        organizer: partnerName,
        status: "PUBLISHED",
        language: "en",
        tags: ["Coursera", "Computer Science", "Online Course"],
        isLinkValid: true,
        updatedAt: now
      });
    }

    return events;
  }
}

import type { TechEvent } from '../../types';

export interface RawOpportunity {
  [key: string]: any;
}

export interface IOpportunityProvider {
  /** Nombre identificador del proveedor (ej: "Coursera", "Eventbrite") */
  name: string;
  
  /** Método principal que orquesta la extracción */
  obtenerOportunidades(): Promise<RawOpportunity[]>;
  
  /** Verifica que la respuesta de la API/Scraping sea válida y no haya bloqueos */
  validarRespuesta(response: any): boolean;
  
  /** Convierte los datos crudos al formato estricto de la base de datos (TechEvent) */
  normalizarDatos(rawData: RawOpportunity[]): TechEvent[];
  
  /** (Opcional) Delegado a actions.ts generalmente, pero disponible para persistencia directa */
  guardarResultados?(normalizedData: TechEvent[]): Promise<void>;
}

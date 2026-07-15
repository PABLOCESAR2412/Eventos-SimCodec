export type EventSource = string; // Permitir cualquier string dado la gran cantidad de fuentes (Devpost, MLH, Coursera, etc)
export type TechCategory = 'Eventos' | 'Formación' | 'Competencias' | 'Emprendimiento' | 'Financiamiento' | 'Comunidad' | 'Empleo';

export interface EventLocation {
  city?: string;
  province?: string;
  country?: string;
  address?: string;
  isVirtual: boolean;
  isHybrid?: boolean;
}

export interface EventDate {
  start: Date;
  end?: Date;
}

export interface TechEvent {
  id?: string;
  externalId?: string;
  title: string;
  description: string;
  url: string; // url de inscripción oficial
  officialUrl?: string; // url de la entidad organizadora
  source: EventSource;
  category: TechCategory | string;
  subcategory?: string;
  location: EventLocation;
  date: EventDate;
  timeString?: string;
  imageUrl?: string;
  isLive: boolean; 
  isFree: boolean;
  price?: string;
  organizer?: string;
  status?: string;
  tags?: string[];
  updatedAt?: number;
}

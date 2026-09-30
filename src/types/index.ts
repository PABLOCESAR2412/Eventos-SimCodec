import type { CatalogEvent } from "../../shared/domain";

// Presentation fields derive from the shared catalog DTO. Only dates and
// location change shape for rendering; domain and price fields stay shared.
export interface TechEvent extends Omit<
  CatalogEvent,
  | "_id"
  | "registrationUrl"
  | "dateStart"
  | "dateEnd"
  | "city"
  | "isVirtual"
  | "address"
  | "searchText"
> {
  id: string;
  url: string;
  location: { city?: string; address?: string; isVirtual: boolean };
  date: { start: Date; end?: Date };
  isLive: boolean;
}

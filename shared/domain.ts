export type EventKind = "EVENT" | "COURSE";
export type PriceStatus = "FREE" | "PAID" | "UNKNOWN";
export type Locale = "es" | "en";
export const TIME_ZONE = "America/Guayaquil";
export const CATALOG_ROWS = 256;
export const CATALOG_BYTES = 600_000;
export const filterOptions = {
  category: [
    "Eventos",
    "Formación",
    "Competencias",
    "Emprendimiento",
    "Financiamiento",
    "Comunidad",
    "Empleo",
  ],
  city: ["Quito", "Guayaquil", "Cuenca", "Virtual"],
  source: [
    "Eventbrite",
    "Luma",
    "Devpost",
    "MLH",
    "Coursera",
    "edX",
    "AWS",
    "Google Cloud",
    "Azure",
    "OpenAI",
    "HuggingFace",
    "Startup Grind",
    "Techstars",
    "Fulbright",
    "EPN",
    "ESPOL",
  ],
  topic: [
    "Conferencias",
    "Congresos",
    "Charlas",
    "Meetups",
    "Workshops",
    "Seminarios",
    "Ferias Tecnológicas",
    "Ferias Empresariales",
    "Networking",
    "Webinars",
    "Cursos",
    "Bootcamps",
    "Diplomados",
    "Certificaciones",
    "Talleres",
    "Programas de Capacitación",
    "Hackathons",
    "Concursos",
    "Olimpiadas",
    "Competencias de IA",
    "Competencias de Ciencia de Datos",
    "Competencias de Programación",
    "Convocatorias",
    "Incubadoras",
    "Aceleradoras",
    "Startup Programs",
    "Demo Days",
    "Pitch Competitions",
    "Becas",
    "Grants",
    "Fondos de Innovación",
    "Capital Semilla",
    "Fondos de Investigación",
    "Mentorías",
    "Comunidades Tech",
    "User Groups",
    "Capítulos IEEE",
    "Google Developer Groups",
    "Women Techmakers",
    "Ferias de Empleo",
    "Recruiting Events",
    "Career Days",
    "Tech Recruiting",
    "IA",
    "Cloud",
    "Startups",
    "Ecuador",
  ],
  modality: ["virtual", "presential"],
  cost: ["free", "paid", "unknown"],
} as const;
export const dateOptions = ["this-month", "next-month", "next-3-months"];
export interface PriceInfo {
  isFree: boolean;
  price?: string;
  priceStatus?: PriceStatus;
  priceAmount?: number;
  priceCurrency?: string;
}
export function priceInfo(value: PriceInfo): {
  priceStatus: PriceStatus;
  priceAmount?: number;
  priceCurrency?: string;
} {
  if (value.priceStatus)
    return {
      priceStatus: value.priceStatus,
      priceAmount: value.priceAmount,
      priceCurrency: value.priceCurrency,
    };
  if (value.isFree)
    return {
      priceStatus: "FREE",
      priceAmount: 0,
      priceCurrency: value.priceCurrency,
    };
  const match = /^\s*(\d+(?:\.\d+)?)\s+([A-Z]{3})\s*$/.exec(value.price ?? "");
  return match
    ? {
        priceStatus: Number(match[1]) === 0 ? "FREE" : "PAID",
        priceAmount: Number(match[1]),
        priceCurrency: match[2],
      }
    : { priceStatus: "UNKNOWN" };
}
export function numericPrice(value: unknown, currency: unknown) {
  const valid =
    (typeof value === "number" ||
      (typeof value === "string" && /^\d+(\.\d+)?$/.test(value.trim()))) &&
    Number.isFinite(Number(value)) &&
    Number(value) >= 0;
  if (!valid)
    return {
      isFree: false,
      priceStatus: "UNKNOWN" as const,
      price: "Consultar valor",
    };
  const amount = Number(value),
    code =
      typeof currency === "string" && /^[A-Z]{3}$/.test(currency)
        ? currency
        : undefined;
  return {
    isFree: amount === 0,
    priceStatus: amount === 0 ? ("FREE" as const) : ("PAID" as const),
    priceAmount: amount,
    priceCurrency: code,
    price: String(amount) + (code ? " " + code : ""),
  };
}
export function priceLabel(value: PriceInfo, locale: Locale = "es") {
  const info = priceInfo(value);
  if (info.priceStatus === "FREE") return locale === "en" ? "Free" : "Gratis";
  if (info.priceStatus === "UNKNOWN")
    return locale === "en" ? "Check price" : "Consultar precio";
  return info.priceAmount !== undefined
    ? String(info.priceAmount) +
        (info.priceCurrency ? " " + info.priceCurrency : "")
    : value.price || (locale === "en" ? "Paid" : "De pago");
}
export function formatDate(
  value: number | Date,
  locale: Locale = "es",
  compact = false,
) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()))
    return locale === "en" ? "Date to be confirmed" : "Fecha por confirmar";
  return (
    new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-EC", {
      timeZone: TIME_ZONE,
      year: compact ? undefined : "numeric",
      month: compact ? "short" : "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date) + " · Ecuador (UTC−5)"
  );
}
export interface CatalogEvent extends PriceInfo {
  _id: string;
  kind: EventKind;
  title: string;
  description: string;
  registrationUrl: string;
  source: string;
  category: string;
  subcategory?: string;
  city?: string;
  isVirtual: boolean;
  address?: string;
  dateStart: number;
  dateEnd?: number;
  imageUrl?: string;
  searchText?: string;
}
export interface CatalogFilters {
  kind?: EventKind;
  searchTerm?: string;
  categories?: string[];
  cities?: string[];
  sources?: string[];
  topics?: string[];
  modalities?: string[];
  costs?: string[];
  dateFrom?: number;
  dateTo?: number;
}
const searchable = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export function matchesCatalog(event: CatalogEvent, filters: CatalogFilters) {
  const text = searchable(
    event.searchText ??
      [
        event.title,
        event.description,
        event.category,
        event.subcategory,
        event.source,
      ].join(" "),
  );
  const any = (values: string[] | undefined, value: string) =>
    !values?.length || values.includes(value);
  return (
    (!filters.kind || event.kind === filters.kind) &&
    (!filters.searchTerm ||
      searchable(filters.searchTerm)
        .split(/\s+/)
        .every((term) => text.includes(term))) &&
    any(filters.categories, event.category) &&
    any(filters.cities, event.isVirtual ? "Virtual" : (event.city ?? "")) &&
    any(filters.sources, event.source) &&
    any(filters.modalities, event.isVirtual ? "virtual" : "presential") &&
    any(filters.costs, priceInfo(event).priceStatus.toLowerCase()) &&
    (!filters.topics?.length ||
      filters.topics.some((topic) => text.includes(searchable(topic)))) &&
    (filters.dateFrom === undefined ||
      event.kind === "COURSE" ||
      event.dateStart >= filters.dateFrom) &&
    (filters.dateTo === undefined ||
      event.kind === "COURSE" ||
      event.dateStart < filters.dateTo)
  );
}
export function pageOffset(cursor: string | null, size: number) {
  if (!cursor) return 0;
  if (!/^p:[1-9]\d{0,5}$/.test(cursor))
    throw new Error("Invalid catalog cursor");
  const offset = Number(cursor.slice(2));
  if (offset % size || offset >= CATALOG_ROWS)
    throw new Error("Invalid catalog cursor");
  return offset;
}
export function catalogPage(
  events: CatalogEvent[],
  filters: CatalogFilters,
  cursor: string | null,
  size: number,
) {
  if (![12, 24, 48].includes(size)) throw new Error("Invalid page size");
  const matches = events.filter((event) => matchesCatalog(event, filters));
  const offset = pageOffset(cursor, size);
  if (offset && offset >= matches.length)
    throw new Error("Invalid catalog cursor");
  return {
    page: matches.slice(offset, offset + size),
    total: matches.length,
    isDone: offset + size >= matches.length,
    continueCursor: "p:" + (offset + size),
    previousCursor: offset > size ? "p:" + (offset - size) : null,
  };
}

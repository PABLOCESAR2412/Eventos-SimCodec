import { XMLParser, XMLValidator } from "fast-xml-parser";
import type { EventInput } from "./model";
import { numericPrice } from "../../shared/domain";
import { providerDate } from "./dates";
type Row = Record<string, unknown>;
const row = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const text = (value: unknown, limit = 300): string => typeof value === "string" ? value.replace(/<[^>]*>/g, "").trim().slice(0, limit) : "";
const array = (value: unknown): unknown[] => Array.isArray(value) ? value.slice(0, 100) : [];
const date = (value: unknown): number => typeof value === "string" ? Date.parse(value) : NaN;
function devpostDates(value: unknown): { start: number; end: number } {
  const match = /^([A-Za-z]{3})\s+(\d{1,2})(?:,\s*(\d{4}))?\s*[-–]\s*([A-Za-z]{3})\s+(\d{1,2}),\s*(\d{4})$/.exec(text(value));
  if (!match) return { start: NaN, end: NaN };
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const first = months.indexOf(match[1]), last = months.indexOf(match[4]), year = Number(match[6]);
  if (first < 0 || last < 0) return { start: NaN, end: NaN };
  return { start: Date.UTC(Number(match[3]) || year - (first > last ? 1 : 0), first, Number(match[2]), 12),
    end: Date.UTC(year, last, Number(match[5]) + 1) - 1 };
}
const base = (source: string): EventInput => ({ title: "", description: "", dateStart: NaN, country: "Global",
  isVirtual: true, isHybrid: false, category: "Eventos", isFree: false, registrationUrl: "",
  status: "PUBLISHED", language: "en", tags: [], source, isLinkValid: true, kind: "EVENT" });
export function parseDevpost(body: string): EventInput[] {
  const data = row(JSON.parse(body));
  if (!Array.isArray(data.hackathons)) throw new Error("Invalid Devpost response");
  return array(data.hackathons).map(value => {
    const hack = row(value);
    const tags = array(hack.themes).map(t => text(row(t).name, 100)).filter(Boolean);
    const period = devpostDates(hack.submission_period_dates);
    const end = Number.isFinite(date(hack.submissions_end)) ? date(hack.submissions_end) : period.end;
    const location = text(hack.location) || text(row(hack.displayed_location).location);
    return { ...base("Devpost"), externalId: "devpost-" + text(String(hack.id)), title: text(hack.title),
      description: ("Hackathon organizado por " + text(hack.organization_name) + ". Premios: " + text(hack.prize_amount) + ". Temas: " + tags.join(", ")).slice(0, 3000),
      registrationUrl: text(hack.url, 2048), category: "Competencias", subcategory: "Hackathons",
      city: location || "Virtual", isVirtual: !location || /online/i.test(location),
      dateStart: Number.isFinite(date(hack.submissions_start)) ? date(hack.submissions_start) : period.start,
      dateEnd: Number.isFinite(end) ? end : undefined,
      imageUrl: text(hack.thumbnail_url, 2048).replace(/^\/\//, "https://") || undefined, isFree: true, price: "Gratis",
      organizer: text(hack.organization_name) || "Devpost", tags };
  });
}
export function parseCoursera(body: string): EventInput[] {
  const data = row(JSON.parse(body));
  if (!Array.isArray(data.elements)) throw new Error("Invalid Coursera response");
  return array(data.elements).map((value): EventInput => {
    const course = row(value);
    return { ...base("Coursera"), externalId: "coursera-" + text(String(course.id)), title: text(course.name),
      description: text(course.description, 3000) || "Curso a tu ritmo. Consulta acceso y condiciones en Coursera.",
      registrationUrl: "https://www.coursera.org/learn/" + encodeURIComponent(text(course.slug)),
      category: "Formación", city: "Virtual", dateStart: 0, kind: "COURSE",
      imageUrl: text(course.photoUrl, 2048) || undefined, price: "Consultar acceso y certificado",
      tags: ["Coursera", "Online Course"] };
  }).filter(e => !e.registrationUrl.endsWith("/learn/"));
}
export function parseWordpress(body: string, source: string): EventInput[] {
  const data = row(JSON.parse(body));
  if (!Array.isArray(data.events)) throw new Error("Invalid WordPress event response");
  return array(data.events).map(value => {
    const event = row(value), venue = row(event.venue);
    // WordPress's UTC fields avoid timezone-dependent interpretation.
    const startTime = providerDate(event.utc_start_date, event.start_date, event.timezone);
    const endTime = providerDate(event.utc_end_date, event.end_date, event.timezone);
    return { ...base(source), externalId: "wp-" + text(event.url, 2000), title: text(event.title),
      description: text(event.description, 3000), registrationUrl: text(event.url, 2048),
      dateStart: startTime,
      dateEnd: Number.isFinite(endTime) ? endTime : undefined,
      country: "Ecuador", city: text(venue.city) || "Varias", isVirtual: !venue.city,
      imageUrl: text(row(event.image).url, 2048) || undefined, language: "es", tags: [source] };
  });
}
export function parseEventbrite(body: string): EventInput[] {
  const match = /window\.__SERVER_DATA__\s*=\s*({.*?});/s.exec(body);
  const scripts = [...body.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  let values: unknown[] = [];
  if (match) {
    const data = row(JSON.parse(match[1]));
    values = array(data.jsonld);
  } else {
    for (const script of scripts.slice(0, 10)) {
      const parsed: unknown = JSON.parse(script);
      values.push(...(Array.isArray(parsed) ? parsed : [parsed]));
    }
  }
  if (!values.length) throw new Error("Eventbrite markup unavailable or blocked");
  const items: unknown[] = [];
  for (const value of values) {
    const item = row(value);
    if (item["@type"] === "Event") items.push(item);
    for (const el of array(item.itemListElement)) items.push(row(el).item ?? el);
  }
  return items.slice(0, 100).map(value => {
    const item = row(value), offers = row(Array.isArray(item.offers) ? item.offers[0] : item.offers);
    const end = date(item.endDate);
    const virtual = item.eventAttendanceMode === "https://schema.org/OnlineEventAttendanceMode" || row(item.location)["@type"] === "VirtualLocation";
    return { ...base("Eventbrite"), title: text(item.name), description: text(item.description, 3000),
      registrationUrl: text(item.url, 2048), externalId: "eventbrite-" + text(item.url, 2000),
      dateStart: date(item.startDate), dateEnd: Number.isFinite(end) ? end : undefined,
      country: virtual ? "Global" : text(row(row(item.location).address).addressCountry) || "Ecuador",
      city: virtual ? "Virtual" : text(row(row(item.location).address).addressLocality) || "Varias",
      isVirtual: virtual, ...numericPrice(offers.price, offers.priceCurrency),
      imageUrl: text(Array.isArray(item.image) ? item.image[0] : item.image, 2048) || undefined, tags: ["Eventbrite"] };
  });
}
export function parseDatedRss(body: string, source: string): EventInput[] {
  if (/<!DOCTYPE|<!ENTITY/i.test(body) || XMLValidator.validate(body) !== true) throw new Error("Invalid RSS XML");
  const parsed = new XMLParser({ ignoreAttributes: false, processEntities: false }).parse(body);
  const items = row(row(parsed).rss).channel;
  const feed = row(items);
  const entries = Array.isArray(feed.item) ? array(feed.item) : feed.item ? [feed.item] : [];
  return entries.map(value => {
    const item = row(value);
    const end = date(item["ev:enddate"] ?? item["event:end"]);
    return { ...base(source), title: text(item.title), description: text(item.description, 3000),
      registrationUrl: text(item.link, 2048), externalId: "rss-event-" + text(item.link, 2000),
      dateStart: date(item["ev:startdate"] ?? item["event:start"] ?? item["schema:startDate"]),
      dateEnd: Number.isFinite(end) ? end : undefined, language: "es", tags: [source] };
  });
}

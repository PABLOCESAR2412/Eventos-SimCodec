import { v } from "convex/values";
export const eventFields = {
  title: v.string(), description: v.string(), dateStart: v.number(),
  dateEnd: v.optional(v.number()), timeString: v.optional(v.string()),
  externalId: v.optional(v.string()), city: v.optional(v.string()),
  province: v.optional(v.string()), country: v.string(), isVirtual: v.boolean(),
  isHybrid: v.boolean(), address: v.optional(v.string()), mapUrl: v.optional(v.string()),
  imageUrl: v.optional(v.string()), organizer: v.optional(v.string()), category: v.string(),
  subcategory: v.optional(v.string()), isFree: v.boolean(), price: v.optional(v.string()),
  officialUrl: v.optional(v.string()), registrationUrl: v.string(), status: v.string(),
  language: v.string(), durationMinutes: v.optional(v.number()), tags: v.array(v.string()),
  capacity: v.optional(v.number()), availableSpots: v.optional(v.number()), source: v.string(),
  apiUsed: v.optional(v.string()), isLinkValid: v.boolean(),
  kind: v.optional(v.union(v.literal("EVENT"), v.literal("COURSE"))),
};
export const eventInput = v.object(eventFields);
export type EventInput = import("convex/values").Infer<typeof eventInput>;
export const DAY = 86_400_000;
export const BATCH_SIZE = 100;
export function canonicalUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.port || value.length > 2048)
    throw new Error("Only public HTTPS URLs without credentials are allowed");
  const host = url.hostname.toLowerCase();
  if (!host.includes(".") || /^[\d.]+$/.test(host) || host.includes(":") ||
      /\.(local|localhost|internal|test|invalid)$/.test(host)) throw new Error("Invalid public hostname");
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_|fbclid$|gclid$|mc_)/i.test(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  url.pathname = url.pathname.replace(/\/$/, "") || "/";
  return url.href;
}
export function normalizeEvent(input: EventInput, now: number): EventInput {
  const event = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as EventInput;
  event.registrationUrl = canonicalUrl(event.registrationUrl);
  if (!event.title.trim() || event.title.length > 300 || event.description.length > 3000 ||
      event.tags.length > 20 || event.tags.some(t => t.length > 100) ||
      !Number.isFinite(event.dateStart) ||
      (event.dateEnd !== undefined && (!Number.isFinite(event.dateEnd) || event.dateEnd < event.dateStart)) ||
      (event.kind !== "COURSE" && (event.dateStart <= 0 || event.dateStart > now + 730 * DAY ||
      (event.dateEnd ?? event.dateStart + DAY) < now))) throw new Error("Invalid event fields or dates");
  if (event.imageUrl) { try { event.imageUrl = canonicalUrl(event.imageUrl); } catch { delete event.imageUrl; } }
  for (const key of ["officialUrl", "mapUrl"] as const) {
    if (event[key]) event[key] = canonicalUrl(event[key]!);
  }
  for (const key of ["externalId", "city", "country", "category", "source", "organizer", "price", "address", "subcategory"] as const) {
    if ((event[key]?.length ?? 0) > 2048) throw new Error("Field too long: " + key);
  }
  event.kind ??= "EVENT";
  event.status = "PUBLISHED";
  return event;
}
export function sameContent(existing: Record<string, unknown>, incoming: EventInput): boolean {
  // Providers cannot reset link health or overwrite stable identity.
  return Object.keys(eventFields).filter(key => !["externalId", "source", "isLinkValid"].includes(key))
    .every(key => JSON.stringify(existing[key]) === JSON.stringify((incoming as unknown as Record<string, unknown>)[key]));
}
export function requireAdmin(token: string) {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected || token.length !== expected.length) throw new Error("Unauthorized");
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  if (difference) throw new Error("Unauthorized");
}

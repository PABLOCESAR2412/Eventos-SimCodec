import { convex } from "./convex";
import { api } from "../../convex/_generated/api";
import type { EventKind, CatalogEvent } from "../../shared/domain";
// At most two entries per server instance. Shared query arguments also let
// Convex reuse results across search/filter URLs and across server instances.
const cache = new Map<
  EventKind,
  { expires: number; data: Promise<CatalogEvent[]> }
>();
export function getCatalogData(kind: EventKind) {
  const existing = cache.get(kind);
  if (existing && existing.expires > Date.now()) return existing.data;
  const token = process.env.CATALOG_TOKEN;
  if (!token) throw new Error("Catalog access is not configured");
  const entry = {
    expires: Date.now() + 60_000,
    data: convex.query(api.events.getCatalogData, { token, kind }),
  };
  cache.set(kind, entry);
  entry.data.catch(() => {
    if (cache.get(kind) === entry) cache.delete(kind);
  });
  return entry.data;
}

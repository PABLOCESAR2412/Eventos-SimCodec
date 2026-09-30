import { convex } from "./convex";
import { api } from "../../convex/_generated/api";
import type { EventKind, CatalogEvent } from "../../shared/domain";
const TTL = 300_000;
// At most two entries per server instance. Stale entries keep serving while a
// single background refresh runs. Shared query arguments also let Convex reuse
// results across search/filter URLs and across server instances.
const cache = new Map<
  EventKind,
  { expires: number; refreshing: boolean; data: Promise<CatalogEvent[]> }
>();
export function getCatalogData(kind: EventKind) {
  const token = process.env.CATALOG_TOKEN;
  if (!token) throw new Error("Catalog access is not configured");
  const existing = cache.get(kind);
  if (existing && existing.expires > Date.now()) return existing.data;
  if (existing) {
    if (!existing.refreshing) refresh(kind, token);
    return existing.data;
  }
  return refresh(kind, token);
}
function refresh(kind: EventKind, token: string) {
  const entry = {
    expires: Date.now() + TTL,
    refreshing: true,
    data: convex.query(api.events.getCatalogData, { token, kind }),
  };
  cache.set(kind, entry);
  entry.data
    .catch(() => {
      if (cache.get(kind) === entry) cache.delete(kind);
    })
    .finally(() => {
      entry.refreshing = false;
    });
  return entry.data;
}

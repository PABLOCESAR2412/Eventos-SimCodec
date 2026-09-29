const multiKeys = ["category", "city", "source", "topic", "modality", "cost"] as const;
export function catalogArgs(params: URLSearchParams) {
  const kind = params.get("view") === "courses" ? "COURSE" as const : "EVENT" as const;
  const multi = (key: string) => [...new Set(params.getAll(key).filter(Boolean))].slice(0, 60).map(v => v.slice(0, 100));
  const pageSize = [12, 24, 48].includes(Number(params.get("size"))) ? Number(params.get("size")) : 12;
  const now = new Date();
  // Calendar filters use Ecuador's UTC-5 boundary and remain stable all month.
  const local = new Date(now.getTime() - 5 * 3_600_000);
  const year = local.getUTCFullYear(), month = local.getUTCMonth();
  const boundary = (offset: number) => Date.UTC(year, month + offset, 1) + 5 * 3_600_000;
  const date = kind === "EVENT" ? params.get("date") : null;
  const dates = date === "this-month" ? { dateFrom: boundary(0), dateTo: boundary(1) }
    : date === "next-month" ? { dateFrom: boundary(1), dateTo: boundary(2) }
    : date === "next-3-months" ? { dateFrom: boundary(0), dateTo: boundary(3) } : {};
  return {
    kind,
    searchTerm: params.get("q")?.trim().slice(0, 100) || undefined,
    categories: multi("category"), cities: multi("city"), sources: multi("source"), topics: multi("topic"),
    modalities: multi("modality").length ? multi("modality") : params.get("virtual") === "true" ? ["virtual"] : [],
    costs: multi("cost").length ? multi("cost") : params.get("free") === "true" ? ["free"] : [],
    ...dates, paginationOpts: { numItems: pageSize, cursor: params.get("cursor")?.slice(0, 4096) || null },
  };
}
export function normalizedCatalogParams(params: URLSearchParams) {
  const result = new URLSearchParams();
  if (params.get("view") === "courses") result.set("view", "courses");
  for (const key of multiKeys) for (const value of [...new Set(params.getAll(key))].sort().slice(0, 60)) {
    if (value) result.append(key, value.slice(0, 100));
  }
  for (const key of ["q", "date", "size", "cursor", "virtual", "free"]) {
    if (key === "date" && result.has("view")) continue;
    const value = params.get(key);
    if (value) result.set(key, value.slice(0, key === "cursor" ? 4096 : 100));
  }
  result.sort();
  return result;
}

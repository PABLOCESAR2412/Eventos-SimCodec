import { filterOptions, dateOptions } from "../../shared/domain";
const multiKeys = [
  "category",
  "city",
  "source",
  "topic",
  "modality",
  "cost",
] as const;
export function catalogArgs(input: URLSearchParams) {
  const params = normalizedCatalogParams(input);
  const kind =
    params.get("view") === "courses" ? ("COURSE" as const) : ("EVENT" as const);
  const multi = (key: string) =>
    [...new Set(params.getAll(key).filter(Boolean))]
      .slice(0, 60)
      .map((v) => v.slice(0, 100));
  const pageSize = [12, 24, 48].includes(Number(params.get("size")))
    ? Number(params.get("size"))
    : 12;
  const now = new Date();
  // Calendar filters use Ecuador's UTC-5 boundary and remain stable all month.
  const local = new Date(now.getTime() - 5 * 3_600_000);
  const year = local.getUTCFullYear(),
    month = local.getUTCMonth();
  const boundary = (offset: number) =>
    Date.UTC(year, month + offset, 1) + 5 * 3_600_000;
  const date = kind === "EVENT" ? params.get("date") : null;
  const dates =
    date === "this-month"
      ? { dateFrom: boundary(0), dateTo: boundary(1) }
      : date === "next-month"
        ? { dateFrom: boundary(1), dateTo: boundary(2) }
        : date === "next-3-months"
          ? { dateFrom: boundary(0), dateTo: boundary(3) }
          : {};
  return {
    kind,
    searchTerm: params.get("q")?.trim().slice(0, 100) || undefined,
    categories: multi("category"),
    cities: multi("city"),
    sources: multi("source"),
    topics: multi("topic"),
    modalities: multi("modality").length
      ? multi("modality")
      : params.get("virtual") === "true"
        ? ["virtual"]
        : [],
    costs: multi("cost").length
      ? multi("cost")
      : params.get("free") === "true"
        ? ["free"]
        : [],
    ...dates,
    paginationOpts: {
      numItems: pageSize,
      cursor: params.get("cursor")?.slice(0, 4096) || null,
    },
  };
}
export function normalizedCatalogParams(params: URLSearchParams) {
  const result = new URLSearchParams();
  if (params.get("view") === "courses") result.set("view", "courses");
  for (const key of multiKeys) {
    const allowed = filterOptions[key] as readonly string[];
    const values = [
      ...new Set(
        params
          .getAll(key)
          .map((value) => value.trim())
          .filter((value) => allowed.includes(value)),
      ),
    ].sort();
    for (const value of values) result.append(key, value);
  }
  if (!result.has("modality") && params.get("virtual") === "true")
    result.append("modality", "virtual");
  if (!result.has("cost") && params.get("free") === "true")
    result.append("cost", "free");
  const query = params.get("q")?.trim().replace(/\s+/g, " ").slice(0, 100);
  if (query) result.set("q", query);
  const date = params.get("date");
  if (!result.has("view") && date && dateOptions.includes(date))
    result.set("date", date);
  const size = params.get("size");
  if (size === "24" || size === "48") result.set("size", size);
  const cursor = params.get("cursor");
  if (cursor) result.set("cursor", cursor.slice(0, 100));
  result.sort();
  return result;
}

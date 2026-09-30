// A provider must supply UTC, an explicit offset, or a timezone we can convert
// without consulting the server's timezone. Ambiguous local times are rejected.
export function providerDate(
  utc: unknown,
  local: unknown,
  timezone: unknown,
): number {
  if (typeof utc === "string" && utc.trim()) {
    const value = utc.trim().replace(" ", "T");
    return Date.parse(
      /[zZ]|[+-]\d{2}:?\d{2}$/.test(value) ? value : value + "Z",
    );
  }
  if (typeof local !== "string") return NaN;
  const value = local.trim().replace(" ", "T");
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)) return Date.parse(value);
  // Current WordPress feeds are Ecuadorian. Other zones need explicit offsets.
  const offset =
    timezone === "America/Guayaquil" || timezone === "UTC-5"
      ? "-05:00"
      : timezone === "UTC" || timezone === "Etc/UTC"
        ? "Z"
        : null;
  return offset && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value)
    ? Date.parse(value + offset)
    : NaN;
}

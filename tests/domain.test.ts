import { rejects } from "node:assert/strict";
import { describe, expect, test } from "bun:test";
import {
  catalogPage,
  formatDate,
  matchesCatalog,
  numericPrice,
  priceInfo,
  priceLabel,
  type CatalogEvent,
} from "../shared/domain";
import { normalizedCatalogParams, catalogArgs } from "../src/lib/catalog";
import { providerDate } from "../convex/lib/dates";
import {
  parseEventbrite,
  parseCoursera,
  parseDatedRss,
  parseWordpress,
} from "../convex/lib/parsers";
import { canonicalUrl, normalizeEvent } from "../convex/lib/model";
import { checkDestination, LINK_HOSTS, safeFetch } from "../convex/lib/http";
import { localeForPath, translator } from "../src/lib/i18n";
const event: CatalogEvent = {
  _id: "event",
  kind: "EVENT",
  title: "Technology",
  description: "Workshops",
  registrationUrl: "https://www.eventbrite.com/e/event",
  dateStart: Date.UTC(2027, 0, 1, 12),
  source: "Eventbrite",
  category: "Eventos",
  isVirtual: true,
  isFree: false,
};
describe("catalog contracts", () => {
  test("filters rare topics before pagination", () => {
    const items = Array.from({ length: 30 }, (_, i) => ({
      ...event,
      _id: String(i),
      description: i === 29 ? "Workshops" : "General",
    }));
    expect(
      catalogPage(items, { topics: ["Workshops"] }, null, 12).page.map(
        (e) => e._id,
      ),
    ).toEqual(["29"]);
  });
  test("combines search and filters before pagination", () => {
    const items = Array.from({ length: 30 }, (_, i) => ({
      ...event,
      _id: String(i),
      source: i === 29 ? "Coursera" : "Eventbrite",
    }));
    expect(
      catalogPage(
        items,
        { searchTerm: "Technology", sources: ["Coursera"] },
        null,
        12,
      ).total,
    ).toBe(1);
  });
  test("previous cursors reach the first page from the third", () => {
    const items = Array.from({ length: 31 }, (_, i) => ({
      ...event,
      _id: String(i),
    }));
    const third = catalogPage(items, {}, "p:24", 12),
      second = catalogPage(items, {}, third.previousCursor, 12);
    expect(third.previousCursor).toBe("p:12");
    expect(second.previousCursor).toBeNull();
    expect(catalogPage(items, {}, second.previousCursor, 12).page[0]._id).toBe(
      "0",
    );
  });
  test("invalid and out of range cursors are input errors", () => {
    for (const cursor of ["invalid", "p:13", "p:999999", "p:24"])
      expect(() => catalogPage([event], {}, cursor, 12)).toThrow(
        "Invalid catalog cursor",
      );
  });
  test("sources use exact equality consistently", () =>
    expect(matchesCatalog(event, { sources: ["Event"] })).toBe(false));
  test("search ignores accents and case", () =>
    expect(
      matchesCatalog(
        { ...event, title: "Formación técnica" },
        { searchTerm: "FORMACION TECNICA" },
      ),
    ).toBe(true));
  test("invalid cache aliases normalize to the same URL", () =>
    expect(
      normalizedCatalogParams(
        new URLSearchParams("size=banana&date=whatever"),
      ).toString(),
    ).toBe(
      normalizedCatalogParams(
        new URLSearchParams("size=other&date=different"),
      ).toString(),
    ));
  test("legacy filter aliases use canonical keys", () =>
    expect(
      normalizedCatalogParams(
        new URLSearchParams("free=true&virtual=true"),
      ).toString(),
    ).toBe("cost=free&modality=virtual"));
  test("course filters discard calendar dates", () =>
    expect(
      catalogArgs(new URLSearchParams("view=courses&date=this-month")).dateFrom,
    ).toBeUndefined());
  test("canonicalization is idempotent", () => {
    const value = normalizedCatalogParams(
      new URLSearchParams(
        "q=  cloud  computing &cost=unknown&size=12&category=Eventos&category=Eventos",
      ),
    );
    expect(normalizedCatalogParams(value).toString()).toBe(value.toString());
  });
});
describe("prices and dates", () => {
  test.each(["", " ", null, undefined, "abc", -1, Infinity])(
    "invalid price remains unknown: %p",
    (value) => expect(numericPrice(value, "USD").priceStatus).toBe("UNKNOWN"),
  );
  test("numeric zero is free, positive price is paid", () => {
    expect(numericPrice("0", "USD").priceStatus).toBe("FREE");
    expect(numericPrice("9.50", "EUR")).toMatchObject({
      priceStatus: "PAID",
      priceAmount: 9.5,
      priceCurrency: "EUR",
    });
  });
  test("unknown prices do not match paid filters", () => {
    expect(priceInfo(event).priceStatus).toBe("UNKNOWN");
    expect(matchesCatalog(event, { costs: ["paid"] })).toBe(false);
    expect(matchesCatalog(event, { costs: ["unknown"] })).toBe(true);
    expect(priceLabel(event, "en")).toBe("Check price");
  });
  test("dates display Ecuador timezone independently of runtime timezone", () => {
    const date = formatDate(Date.UTC(2027, 0, 1, 12), "en");
    expect(date).toContain("07:00 AM");
    expect(date).toContain("UTC−5");
  });
  test("WordPress local fallback converts Ecuador to UTC", () => {
    expect(
      providerDate(undefined, "2027-01-01 10:00:00", "America/Guayaquil"),
    ).toBe(Date.UTC(2027, 0, 1, 15));
    expect(
      Number.isNaN(providerDate(undefined, "2027-01-01 10:00:00", undefined)),
    ).toBe(true);
  });
  test("WordPress UTC and explicit offsets remain stable", () => {
    expect(providerDate("2027-01-01 10:00:00", "", "")).toBe(
      Date.UTC(2027, 0, 1, 10),
    );
    expect(providerDate("", "2027-01-01T10:00:00-05:00", "")).toBe(
      Date.UTC(2027, 0, 1, 15),
    );
  });
  test("parser uses timezone fallback", () =>
    expect(
      parseWordpress(
        JSON.stringify({
          events: [
            {
              title: "test",
              url: "https://www.espol.edu.ec/test",
              start_date: "2027-01-01 10:00:00",
              timezone: "America/Guayaquil",
            },
          ],
        }),
        "ESPOL",
      )[0].dateStart,
    ).toBe(Date.UTC(2027, 0, 1, 15)));
  test("Eventbrite empty price is unknown", () =>
    expect(
      parseEventbrite(
        '<script type="application/ld+json">' +
          JSON.stringify({
            "@type": "Event",
            name: "Test",
            startDate: "2027-01-01T10:00:00Z",
            url: event.registrationUrl,
            offers: { price: "", priceCurrency: "USD" },
          }) +
          "</script>",
      )[0],
    ).toMatchObject({ isFree: false, priceStatus: "UNKNOWN" }));
  test("Coursera never fabricates dates or prices", () => {
    const course = parseCoursera(
      JSON.stringify({ elements: [{ id: "1", name: "Test", slug: "test" }] }),
    )[0];
    expect(course.kind).toBe("COURSE");
    expect(course.dateStart).toBe(0);
    expect(priceInfo(course).priceStatus).toBe("UNKNOWN");
  });
});
describe("security and localization", () => {
  test("ingestion rejects expired and inverted dates", () => {
    const course = parseCoursera(
      JSON.stringify({ elements: [{ id: "1", name: "Test", slug: "test" }] }),
    )[0];
    expect(() =>
      normalizeEvent(
        { ...course, kind: "EVENT", dateStart: 1000, dateEnd: 2000 },
        Date.now(),
      ),
    ).toThrow();
    expect(() =>
      normalizeEvent(
        {
          ...course,
          kind: "EVENT",
          dateStart: Date.now() + 1000,
          dateEnd: Date.now(),
        },
        Date.now(),
      ),
    ).toThrow();
  });
  test("normalization synchronizes price fields and rejects contradictions", () => {
    const course = parseCoursera(
      JSON.stringify({ elements: [{ id: "1", name: "Test", slug: "test" }] }),
    )[0];
    expect(normalizeEvent(course, Date.now())).toMatchObject({
      kind: "COURSE",
      priceStatus: "UNKNOWN",
      isFree: false,
    });
    expect(() =>
      normalizeEvent(
        { ...course, priceStatus: "FREE", priceAmount: 10 },
        Date.now(),
      ),
    ).toThrow("Inconsistent price");
  });
  test.each([
    "http://www.eventbrite.com/",
    "https://user:pass@www.eventbrite.com/",
    "https://127.0.0.1/",
    "https://www.eventbrite.com:8443/",
  ])("rejects unsafe URL %s", (url) =>
    expect(() => canonicalUrl(url)).toThrow(),
  );
  test("canonical URL strips tracking and sorts parameters", () =>
    expect(
      canonicalUrl(
        "https://www.eventbrite.com/e/test/?utm_source=x&b=2&a=1#fragment",
      ),
    ).toBe("https://www.eventbrite.com/e/test?a=1&b=2"));
  test.each([
    "eventbrite.ca",
    "eventbrite.co.uk",
    "eventbrite.com.ar",
    "eventbrite.cl",
    "eventbrite.fr",
  ])("regional link accepted: %s", (host) =>
    expect(
      checkDestination("https://www." + host + "/e/test", LINK_HOSTS),
    ).toContain(host),
  );
  test("lookalike domains rejected", () =>
    expect(() =>
      checkDestination("https://eventbrite.com.attacker.example/", LINK_HOSTS),
    ).toThrow());
  test("RSS entities and publication-only dates rejected", () => {
    expect(() => parseDatedRss("<!DOCTYPE rss><rss/>", "Test")).toThrow();
    expect(
      Number.isNaN(
        parseDatedRss(
          "<rss><channel><item><title>Test</title><pubDate>2027-01-01</pubDate></item></channel></rss>",
          "Test",
        )[0].dateStart,
      ),
    ).toBe(true);
  });
  test("English interface translates core controls", () => {
    const t = translator(localeForPath("/en/"));
    expect(t("Eventos con fecha")).toBe("Scheduled events");
    expect(t("Filtros")).toBe("Filters");
    expect(t("Cursos a tu ritmo")).toBe("Self-paced courses");
  });
  test("HTTP byte budget and redirected host enforced", async () => {
    const old = globalThis.fetch;
    try {
      globalThis.fetch = (async () =>
        new Response("123456789")) as unknown as typeof fetch;
      await rejects(
        safeFetch(event.registrationUrl, { hosts: LINK_HOSTS, maxBytes: 4 }),
        /Response too large/,
      );
      globalThis.fetch = (async () =>
        new Response(null, {
          status: 302,
          headers: { location: "https://attacker.example/" },
        })) as unknown as typeof fetch;
      await rejects(
        safeFetch(event.registrationUrl, { hosts: LINK_HOSTS }),
        /Host not allowed/,
      );
    } finally {
      globalThis.fetch = old;
    }
  });
});

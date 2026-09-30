import { rejects } from "node:assert/strict";
import { expect, test } from "bun:test";
import { getCatalogData, recordLinkResults } from "../convex/events";
import { syncApiSources } from "../convex/actions";
import {
  AdminCursorError,
  decodeAdminCursor,
  encodeAdminCursor,
} from "../src/lib/admin-pagination";
import { repairContracts, repairLegacyLinkHealth } from "../convex/maintenance";
import { consumeRate } from "../src/lib/rate-limit";
import {
  createSession,
  hashPassword,
  readLoginForm,
  sameOriginForm,
  SESSION_SECONDS,
  validSession,
  verifyPassword,
} from "../src/lib/admin-auth";
// Registered Convex handlers execute against small deterministic persistence doubles.
const handler = (value: unknown) =>
  (value as { _handler: (ctx: unknown, args: unknown) => Promise<unknown> })
    ._handler;
test("503 then one 404 remains visible; two consecutive gone responses hide", async () => {
  let event = {
    _id: "sample",
    status: "PUBLISHED",
    isLinkValid: true,
    linkFailures: 1,
    lastLinkStatus: 503,
    linkGoneFailures: 0,
  };
  const ctx = {
    db: {
      get: async () => event,
      patch: async (_id: string, value: object) => {
        event = { ...event, ...value };
      },
    },
  };
  await handler(recordLinkResults)(ctx, {
    results: [{ id: "sample", status: 404, checkedAt: 1000 }],
  });
  expect(event.isLinkValid).toBe(true);
  expect(event.linkGoneFailures).toBe(1);
  await handler(recordLinkResults)(ctx, {
    results: [{ id: "sample", status: 410, checkedAt: 2000 }],
  });
  expect(event.isLinkValid).toBe(false);
  expect(event.linkGoneFailures).toBe(2);
  await handler(recordLinkResults)(ctx, {
    results: [{ id: "sample", status: 200, checkedAt: 3000 }],
  });
  expect(event.isLinkValid).toBe(true);
  expect(event.linkFailures).toBe(0);
  expect(event.linkGoneFailures).toBe(0);
});
test("transient errors reset the consecutive gone count", async () => {
  let patch: Record<string, unknown> = {};
  await handler(recordLinkResults)(
    {
      db: {
        get: async () => ({
          _id: "sample",
          status: "PUBLISHED",
          isLinkValid: true,
          linkGoneFailures: 1,
        }),
        patch: async (_id: string, value: object) => {
          patch = { ...value };
        },
      },
    },
    { results: [{ id: "sample", status: 503, checkedAt: 1000 }] },
  );
  expect(patch.linkGoneFailures).toBe(0);
  expect(patch.isLinkValid).toBe(true);
});
test("policy rejection stops automatic retries without hiding", async () => {
  let patch: Record<string, unknown> = {};
  await handler(recordLinkResults)(
    {
      db: {
        get: async () => ({
          _id: "sample",
          status: "PUBLISHED",
          isLinkValid: true,
        }),
        patch: async (_id: string, value: object) => {
          patch = { ...value };
        },
      },
    },
    { results: [{ id: "sample", status: -1, checkedAt: 1000 }] },
  );
  expect(patch.nextLinkCheck).toBe(Number.MAX_SAFE_INTEGER);
  expect(patch.isLinkValid).toBe(true);
});
test("304 records successful source recovery without writing catalog events", async () => {
  const old = globalThis.fetch;
  const records: Record<string, unknown>[] = [];
  try {
    globalThis.fetch = (async () =>
      new Response(null, { status: 304 })) as unknown as typeof fetch;
    await handler(syncApiSources)(
      {
        runQuery: async () => ({ etag: "old", failures: 2, nextAttemptAt: 0 }),
        runMutation: async (_ref: unknown, args: Record<string, unknown>) => {
          records.push(args);
          return {};
        },
      },
      {},
    );
    expect(records.filter((value) => value.failed === false)).toHaveLength(2);
    expect(records.some((value) => "events" in value)).toBe(false);
  } finally {
    globalThis.fetch = old;
  }
});
test("catalog uses ordinary bounded index and rejects incomplete candidate sets", async () => {
  const oldToken = process.env.CATALOG_TOKEN;
  process.env.CATALOG_TOKEN = "test-token";
  let queries = 0,
    budget: Record<string, unknown> = {};
  const ctx = {
    db: {
      query: () => {
        queries++;
        return {
          withIndex: () => ({
            paginate: async (options: Record<string, unknown>) => {
              budget = options;
              return { page: [], isDone: false };
            },
          }),
        };
      },
    },
  };
  try {
    await rejects(
      handler(getCatalogData)(ctx, {
        token: "wrong",
        kind: "EVENT",
      }),
      /Unauthorized/,
    );
    expect(queries).toBe(0);
    await rejects(
      handler(getCatalogData)(ctx, {
        token: "test-token",
        kind: "EVENT",
      }),
      /CATALOG_CAPACITY/,
    );
    expect(budget).toMatchObject({
      maximumRowsRead: 256,
      maximumBytesRead: 600000,
    });
  } finally {
    if (oldToken === undefined) delete process.env.CATALOG_TOKEN;
    else process.env.CATALOG_TOKEN = oldToken;
  }
});
test("contract migration preserves inverted originals and is idempotent", async () => {
  let event = {
    _id: "sample",
    migrationVersion: 1,
    source: "Devpost",
    kind: "EVENT",
    dateStart: 2000,
    dateEnd: 1000,
    isFree: true,
    status: "FINISHED",
  };
  const ctx = {
    db: {
      query: () => ({
        paginate: async () => ({ page: [event], isDone: true }),
      }),
      patch: async (_id: string, value: object) => {
        event = { ...event, ...value };
      },
    },
  };
  const first = await handler(repairContracts)(ctx, {});
  expect(first).toMatchObject({ repaired: 1, quarantined: 1 });
  expect(event).toMatchObject({
    originalDates: { dateStart: 2000, dateEnd: 1000 },
    status: "QUARANTINED",
    migrationVersion: 2,
  });
  expect(event.dateEnd).toBeUndefined();
  expect(await handler(repairContracts)(ctx, {})).toMatchObject({
    repaired: 0,
  });
});
test("in-memory rate limiter rejects the sixth login and the sixty-first catalog hit", async () => {
  const ip = "203.0.113.7";
  for (let i = 0; i < 5; i++)
    expect(await consumeRate(ip, "login")).toMatchObject({ allowed: true });
  const sixth = await consumeRate(ip, "login");
  expect(sixth.allowed).toBe(false);
  expect(sixth.retryAfter).toBeGreaterThan(0);
  expect((await consumeRate("198.51.100.9", "login")).allowed).toBe(true);
  for (let i = 0; i < 60; i++)
    expect(await consumeRate(ip, "catalog")).toMatchObject({ allowed: true });
  expect((await consumeRate(ip, "catalog")).allowed).toBe(false);
});
test("login verifies password without accepting malformed hashes", () => {
  const hash = hashPassword("strong-test-password");
  expect(verifyPassword("strong-test-password", hash)).toBe(true);
  expect(verifyPassword("wrong", hash)).toBe(false);
  expect(verifyPassword("strong-test-password", "invalid")).toBe(false);
});
test("admin cursors round trip and reject tampering before database access", () => {
  const secret = "s".repeat(64),
    cursor = encodeAdminCursor("opaque-convex-cursor", secret);
  expect(decodeAdminCursor(null, secret)).toBeNull();
  expect(decodeAdminCursor(cursor, secret)).toBe("opaque-convex-cursor");
  expect(() => decodeAdminCursor("invalid", secret)).toThrow(AdminCursorError);
  expect(() => decodeAdminCursor(cursor + "x", secret)).toThrow(
    AdminCursorError,
  );
  expect(() => decodeAdminCursor(cursor, "t".repeat(64))).toThrow(
    AdminCursorError,
  );
  expect(validSession(cursor, "admin", secret)).toBe(false);
});
test("session rejects tampering, expiry and another user", () => {
  const secret = "s".repeat(64),
    now = 1_000_000,
    cookie = createSession("admin", secret, now);
  expect(validSession(cookie, "admin", secret, now)).toBe(true);
  expect(validSession(cookie + "x", "admin", secret, now)).toBe(false);
  expect(validSession(cookie, "other", secret, now)).toBe(false);
  expect(
    validSession(cookie, "admin", secret, now + SESSION_SECONDS * 1000),
  ).toBe(false);
});
test("cross-origin form posts and oversized bodies are rejected", async () => {
  const url = new URL("https://events.example/admin/login");
  expect(
    sameOriginForm(
      new Request(url, {
        method: "POST",
        headers: {
          origin: "https://attacker.example",
          "content-type": "application/x-www-form-urlencoded",
        },
        body: "username=admin",
      }),
      url,
    ),
  ).toBe(false);
  await rejects(
    readLoginForm(new Request(url, { method: "POST", body: "x".repeat(5000) })),
    /Form too large/,
  );
});

test("legacy hidden links are rechecked without reviving confirmed failures", async () => {
  const restored: string[] = [];
  await handler(repairLegacyLinkHealth)(
    {
      db: {
        query: () => ({
          withIndex: () => ({
            paginate: async () => ({
              isDone: true,
              page: [
                { _id: "legacy", lastLinkStatus: 404, linkGoneFailures: 0 },
                { _id: "confirmed", lastLinkStatus: 404, linkGoneFailures: 2 },
              ],
            }),
          }),
        }),
        patch: async (id: string) => {
          restored.push(id);
        },
      },
    },
    {},
  );
  expect(restored).toEqual(["legacy"]);
});

import { rejects } from "node:assert/strict";
import { expect, test } from "bun:test";
import { getCatalogPage, recordLinkResults } from "../convex/events";
import { syncApiSources } from "../convex/actions";
import { repairContracts, repairLegacyLinkHealth } from "../convex/maintenance";
import { consume } from "../convex/security";
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
  const oldGate = process.env.CATALOG_REQUIRE_TOKEN,
    oldToken = process.env.CATALOG_TOKEN;
  process.env.CATALOG_REQUIRE_TOKEN = "true";
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
      handler(getCatalogPage)(ctx, {
        kind: "EVENT",
        paginationOpts: { cursor: null, numItems: 12 },
      }),
      /Unauthorized/,
    );
    expect(queries).toBe(0);
    await rejects(
      handler(getCatalogPage)(ctx, {
        token: "test-token",
        kind: "EVENT",
        paginationOpts: { cursor: null, numItems: 12 },
      }),
      /CATALOG_CAPACITY/,
    );
    expect(budget).toMatchObject({
      maximumRowsRead: 256,
      maximumBytesRead: 600000,
    });
  } finally {
    if (oldGate === undefined) delete process.env.CATALOG_REQUIRE_TOKEN;
    else process.env.CATALOG_REQUIRE_TOKEN = oldGate;
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
test("durable rate limiter rejects sixth login and does not write on rejection", async () => {
  const old = process.env.CATALOG_TOKEN;
  process.env.CATALOG_TOKEN = "test-token";
  const rows = new Map<
    string,
    { _id: string; key: string; count: number; resetAt: number }
  >();
  let writes = 0;
  const ctx = {
    db: {
      query: () => ({
        withIndex: (
          _index: string,
          build: (q: { eq: (field: string, key: string) => string }) => string,
        ) => {
          const key = build({ eq: (_field, key) => key });
          return { unique: async () => rows.get(key) ?? null };
        },
      }),
      insert: async (
        _table: string,
        value: { key: string; count: number; resetAt: number },
      ) => {
        writes++;
        rows.set(value.key, { ...value, _id: value.key });
      },
      patch: async (
        id: string,
        value: { key: string; count: number; resetAt: number },
      ) => {
        writes++;
        rows.set(id, { ...value, _id: id });
      },
    },
  };
  try {
    for (let i = 0; i < 5; i++)
      expect(
        await handler(consume)(ctx, {
          token: "test-token",
          key: "a".repeat(64),
          scope: "login",
        }),
      ).toMatchObject({ allowed: true });
    const before = writes;
    expect(
      await handler(consume)(ctx, {
        token: "test-token",
        key: "a".repeat(64),
        scope: "login",
      }),
    ).toMatchObject({ allowed: false });
    expect(writes).toBe(before);
    await rejects(
      handler(consume)(ctx, {
        token: "wrong",
        key: "b".repeat(64),
        scope: "login",
      }),
      /Unauthorized/,
    );
  } finally {
    if (old === undefined) delete process.env.CATALOG_TOKEN;
    else process.env.CATALOG_TOKEN = old;
  }
});
test("login verifies password without accepting malformed hashes", () => {
  const hash = hashPassword("strong-test-password");
  expect(verifyPassword("strong-test-password", hash)).toBe(true);
  expect(verifyPassword("wrong", hash)).toBe(false);
  expect(verifyPassword("strong-test-password", "invalid")).toBe(false);
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

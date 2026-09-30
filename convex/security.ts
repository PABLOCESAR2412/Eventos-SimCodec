import { mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requireSecret } from "./lib/model";
export const consume = mutation({
  args: {
    token: v.string(),
    key: v.string(),
    scope: v.union(v.literal("catalog"), v.literal("login")),
  },
  handler: async (ctx, args) => {
    requireSecret(args.token, process.env.CATALOG_TOKEN);
    if (!/^[a-f0-9]{64}$/.test(args.key)) throw new Error("Invalid rate key");
    const now = Date.now(),
      duration = args.scope === "login" ? 15 * 60_000 : 60_000;
    const policies = [
      {
        key: args.scope + ":" + args.key,
        max: args.scope === "login" ? 5 : 60,
      },
      { key: args.scope + ":global", max: args.scope === "login" ? 100 : 300 },
    ];
    const rows = await Promise.all(
      policies.map((policy) =>
        ctx.db
          .query("rateLimits")
          .withIndex("by_key", (q) => q.eq("key", policy.key))
          .unique(),
      ),
    );
    const blocked = rows.find(
      (value, index) =>
        value && value.resetAt > now && value.count >= policies[index].max,
    );
    if (blocked)
      return {
        allowed: false,
        retryAfter: Math.ceil((blocked.resetAt - now) / 1000),
      };
    for (let i = 0; i < rows.length; i++) {
      const existing = rows[i];
      const value = {
        key: policies[i].key,
        count: existing && existing.resetAt > now ? existing.count + 1 : 1,
        resetAt:
          existing && existing.resetAt > now
            ? existing.resetAt
            : now + duration,
      };
      if (existing) await ctx.db.patch(existing._id, value);
      else await ctx.db.insert("rateLimits", value);
    }
    return { allowed: true, retryAfter: 0 };
  },
});
export const prune = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("rateLimits")
      .withIndex("by_reset", (q) => q.lt("resetAt", Date.now() - 86_400_000))
      .take(100);
    for (const row of rows) await ctx.db.delete(row._id);
    return rows.length;
  },
});

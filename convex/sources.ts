import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
export const get = internalQuery({
  args: { url: v.string() },
  handler: (ctx, args) => ctx.db.query("sourceState").withIndex("by_url", q => q.eq("url", args.url)).first(),
});
export const record = internalMutation({
  args: { url: v.string(), etag: v.optional(v.string()), modified: v.optional(v.string()), failed: v.boolean(), retryAfterMs: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const old = await ctx.db.query("sourceState").withIndex("by_url", q => q.eq("url", args.url)).first();
    const failures = args.failed ? (old?.failures ?? 0) + 1 : 0;
    const record = { url: args.url, failures,
      etag: args.failed ? old?.etag : args.etag ?? old?.etag,
      modified: args.failed ? old?.modified : args.modified ?? old?.modified,
      nextAttemptAt: args.failed ? Date.now() + Math.min(7 * 86_400_000, Math.max(args.retryAfterMs ?? 0, 3_600_000 * 2 ** Math.min(failures, 7))) : 0 };
    if (old) {
      if (JSON.stringify(record) !== JSON.stringify({ url: old.url, failures: old.failures, etag: old.etag, modified: old.modified, nextAttemptAt: old.nextAttemptAt })) await ctx.db.patch(old._id, record);
    } else await ctx.db.insert("sourceState", record);
  },
});

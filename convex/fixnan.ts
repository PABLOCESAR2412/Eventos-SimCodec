import { internalMutation } from "./_generated/server";

export const fixNan = internalMutation({
  args: {},
  handler: async (ctx) => {
    const events = await ctx.db.query("events").collect();
    for (const e of events) {
      if (e.source === "Devpost") {
        await ctx.db.patch(e._id, { dateEnd: Date.now() + (86400000 * 30) });
      }
    }
  }
});

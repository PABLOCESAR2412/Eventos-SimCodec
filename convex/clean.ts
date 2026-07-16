import { mutation } from "./_generated/server";

export default mutation({
  args: {},
  handler: async (ctx) => {
    const events = await ctx.db
      .query("events")
      .filter((q) => q.eq(q.field("source"), "Medios Nacionales"))
      .collect();

    let deleted = 0;
    for (const ev of events) {
      await ctx.db.delete(ev._id);
      deleted++;
    }
    return `Deleted ${deleted} news events.`;
  }
});

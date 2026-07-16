import { mutation } from "./_generated/server";

export default mutation({
  args: {},
  handler: async (ctx) => {
    const events = await ctx.db
      .query("events")
      .collect();

    let deleted = 0;
    for (const ev of events) {
      if (
        ev.externalId.startsWith("rss-") ||
        ev.externalId.startsWith("news-") ||
        ev.externalId.startsWith("devto-") ||
        ev.source === "Medios Nacionales" ||
        ev.tags?.includes("News")
      ) {
        await ctx.db.delete(ev._id);
        deleted++;
      }
    }
    return `Deleted ${deleted} news/blog events.`;
  }
});

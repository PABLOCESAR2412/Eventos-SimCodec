import { internalMutation } from "./_generated/server";

export default internalMutation(async (ctx) => {
  const evs = await ctx.db.query("events").collect();
  for (const e of evs) {
    await ctx.db.delete(e._id);
  }
});

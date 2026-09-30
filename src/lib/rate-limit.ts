import { createHmac } from "node:crypto";
import { convex } from "./convex";
import { api } from "../../convex/_generated/api";
export async function consumeRate(
  clientAddress: string,
  scope: "catalog" | "login",
) {
  const token = process.env.CATALOG_TOKEN;
  if (!token) throw new Error("Rate limiting is not configured");
  const key = createHmac("sha256", token).update(clientAddress).digest("hex");
  return convex.mutation(api.security.consume, { token, key, scope });
}

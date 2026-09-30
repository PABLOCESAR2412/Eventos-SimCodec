import { createHmac, timingSafeEqual } from "node:crypto";
export class AdminCursorError extends Error {}
function sign(value: string, secret: string) {
  return createHmac("sha256", secret)
    .update("admin-cursor:" + value)
    .digest("base64url");
}
export function encodeAdminCursor(cursor: string, secret: string) {
  if (!cursor || cursor.length > 4096 || secret.length < 32)
    throw new AdminCursorError("Invalid admin cursor");
  const value = Buffer.from(cursor).toString("base64url");
  return value + "." + sign(value, secret);
}
export function decodeAdminCursor(cursor: string | null, secret: string) {
  if (cursor === null) return null;
  if (cursor.length > 8192 || secret.length < 32)
    throw new AdminCursorError("Invalid admin cursor");
  const match = /^([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]{43})$/.exec(cursor);
  if (!match) throw new AdminCursorError("Invalid admin cursor");
  const supplied = Buffer.from(match[2]),
    expected = Buffer.from(sign(match[1], secret));
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  )
    throw new AdminCursorError("Invalid admin cursor");
  const decoded = Buffer.from(match[1], "base64url").toString();
  if (!decoded || decoded.length > 4096)
    throw new AdminCursorError("Invalid admin cursor");
  return decoded;
}

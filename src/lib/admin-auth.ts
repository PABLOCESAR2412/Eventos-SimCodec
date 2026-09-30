import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
export const SESSION_COOKIE = "simcodec_admin";
export const SESSION_SECONDS = 8 * 60 * 60;
export class LoginInputError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 413 = 400,
  ) {
    super(message);
  }
}
function equal(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function hashPassword(
  password: string,
  salt = randomBytes(16).toString("hex"),
) {
  return (
    "scrypt:" + salt + ":" + scryptSync(password, salt, 64).toString("hex")
  );
}
export function verifyPassword(password: string, encoded: string) {
  const [algorithm, salt, hash] = encoded.split(":");
  if (
    algorithm !== "scrypt" ||
    !/^[a-f0-9]{32}$/.test(salt ?? "") ||
    !/^[a-f0-9]{128}$/.test(hash ?? "") ||
    password.length > 128
  )
    return false;
  return equal(scryptSync(password, salt, 64).toString("hex"), hash);
}
function signature(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}
export function createSession(
  username: string,
  secret: string,
  now = Date.now(),
) {
  if (secret.length < 32) throw new Error("Session signing is not configured");
  const value = Buffer.from(
    JSON.stringify({ username, expires: now + SESSION_SECONDS * 1000 }),
  ).toString("base64url");
  return value + "." + signature(value, secret);
}
export function validSession(
  cookie: string | undefined,
  username: string | undefined,
  secret: string | undefined,
  now = Date.now(),
) {
  if (
    !cookie ||
    !username ||
    !secret ||
    secret.length < 32 ||
    cookie.length > 1024
  )
    return false;
  const [value, signed, extra] = cookie.split(".");
  if (extra || !signed || !equal(signed, signature(value, secret)))
    return false;
  try {
    const p = JSON.parse(Buffer.from(value, "base64url").toString());
    return (
      p.username === username &&
      Number.isFinite(p.expires) &&
      p.expires > now
    );
  } catch {
    return false;
  }
}
export function sameOriginForm(request: Request, url: URL) {
  return (
    request.headers.get("origin") === url.origin &&
    request.headers.get("content-type")?.split(";")[0] ===
      "application/x-www-form-urlencoded"
  );
}
export async function readLoginForm(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new LoginInputError("Missing form");
  let bytes = 0,
    body = "";
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 4096) {
        await reader.cancel();
        throw new LoginInputError("Form too large", 413);
      }
      body += decoder.decode(value, { stream: true });
    }
    return new URLSearchParams(body + decoder.decode());
  } finally {
    reader.releaseLock();
  }
}

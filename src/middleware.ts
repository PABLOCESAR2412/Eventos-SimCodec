import { defineMiddleware } from "astro:middleware";
import { timingSafeEqual } from "node:crypto";
import { normalizedCatalogParams } from "./lib/catalog";
export const onRequest = defineMiddleware(async (context, next) => {
  const admin = /^\/admin\/?$/.test(context.url.pathname);
  if (admin) {
    const token = process.env.ADMIN_TOKEN || import.meta.env.ADMIN_TOKEN;
    const expected = Buffer.from("Basic " + Buffer.from("admin:" + (token ?? "")).toString("base64"));
    const supplied = Buffer.from(context.request.headers.get("authorization") ?? "");
    if (!token || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      return new Response("Acceso administrativo requerido.", { status: 401, headers: {
        "WWW-Authenticate": 'Basic realm="SimCodec admin", charset="UTF-8"',
        "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow",
        "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY",
      } });
    }
  } else if (["/", "/en", "/en/"].includes(context.url.pathname)) {
    const normalized = normalizedCatalogParams(context.url.searchParams).toString();
    if (normalized !== context.url.searchParams.toString()) {
      return Response.redirect(new URL(context.url.pathname + (normalized ? "?" + normalized : ""), context.url), 308);
    }
  }
  const response = await next();
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Content-Security-Policy", "object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
  if (context.url.protocol === "https:") response.headers.set("Strict-Transport-Security", "max-age=31536000");
  if (admin) {
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
});

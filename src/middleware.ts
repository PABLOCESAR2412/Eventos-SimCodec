import { defineMiddleware } from "astro:middleware";
import { normalizedCatalogParams } from "./lib/catalog";
import { SESSION_COOKIE, validSession } from "./lib/admin-auth";
import { consumeRate } from "./lib/rate-limit";
export const onRequest = defineMiddleware(async (context, next) => {
  const admin = /^\/admin(?:\/|$)/.test(context.url.pathname);
  const login = /^\/admin\/login\/?$/.test(context.url.pathname);
  const catalog = ["/", "/en", "/en/"].includes(context.url.pathname);
  let response: Response;
  if (
    admin &&
    !login &&
    !validSession(
      context.cookies.get(SESSION_COOKIE)?.value,
      process.env.ADMIN_USERNAME,
      process.env.ADMIN_SESSION_SECRET,
    )
  )
    response = context.redirect("/admin/login", 303);
  else if (catalog) {
    const normalized = normalizedCatalogParams(
      context.url.searchParams,
    ).toString();
    if (normalized !== context.url.searchParams.toString())
      response = context.redirect(
        context.url.pathname + (normalized ? "?" + normalized : ""),
        308,
      );
    else {
      try {
        const rate = await consumeRate(context.clientAddress, "catalog");
        response = rate.allowed
          ? await next()
          : new Response(
              context.url.pathname.startsWith("/en")
                ? "Too many requests. Try again shortly."
                : "Demasiadas peticiones. Vuelve a intentar en un minuto.",
              {
                status: 429,
                headers: {
                  "Retry-After": String(rate.retryAfter),
                  "Cache-Control": "no-store",
                },
              },
            );
      } catch {
        response = new Response(
          context.url.pathname.startsWith("/en")
            ? "Catalog temporarily unavailable."
            : "Catálogo temporalmente no disponible.",
          {
            status: 503,
            headers: { "Cache-Control": "no-store", "Retry-After": "60" },
          },
        );
      }
    }
  } else response = await next();
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Content-Security-Policy",
    "object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
  );
  if (context.url.protocol === "https:")
    response.headers.set("Strict-Transport-Security", "max-age=31536000");
  if (admin) {
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
});
